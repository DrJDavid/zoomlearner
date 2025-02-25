import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    VStack,
    Input,
    Button,
    Text,
    useToast,
    Spinner,
    HStack,
    IconButton,
    Tooltip,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
} from '@chakra-ui/react';
import { EditIcon } from '@chakra-ui/icons';
import { AIService } from '../lib/ai';
import { supabase } from '../lib/supabase';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
    session_id: string;
}

interface ChatModalProps {
    isDarkMode: boolean;
    currentText: string;
    currentWord: string;
    currentSpeed: number;
    documentId?: string;
    readingSessionId?: string;
    isEmbedded?: boolean;
    isOpen: boolean;
    onClose: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({
    isDarkMode,
    currentText,
    currentWord,
    currentSpeed,
    documentId,
    readingSessionId,
    isEmbedded = false,
    isOpen,
    onClose
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const toast = useToast();
    const [chatSessionId, setChatSessionId] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);

    const aiService = useMemo(() => new AIService({
        currentText,
        currentWord,
        currentSpeed: currentSpeed || 0,
        documentId,
        readingSessionId,
        chatSessionId
    }), [currentText, currentWord, currentSpeed, documentId, readingSessionId, chatSessionId]);

    // Load chat messages and create a chat session if needed
    const loadMessages = useCallback(async () => {
        if (!readingSessionId) return;
        
        try {
            setError(null);
            
            // First, find or create a chat session for this reading session
            const { data: chatSessions, error: findError } = await supabase
                .from('chat_sessions')
                .select('id')
                .eq('reading_session_id', readingSessionId);
            
            if (findError) {
                console.error('Error finding chat sessions:', findError);
                setError('Failed to load chat history.');
                return;
            }
            
            let sessionId: string | undefined;
            
            // If no chat session exists, create one
            if (!chatSessions || chatSessions.length === 0) {
                const { data: newSession, error: createError } = await supabase.rpc('create_chat_session', {
                    p_reading_session_id: readingSessionId,
                    p_title: 'Chat about reading'
                });
                
                if (createError) {
                    console.error('Error creating chat session:', createError);
                    setError('Failed to create chat session.');
                    return;
                }
                
                sessionId = newSession;
            } else {
                sessionId = chatSessions[0].id;
            }
            
            // Save the chat session ID
            setChatSessionId(sessionId);
            
            // Now get messages for this chat session
            const { data: chatMessages, error: messagesError } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });
                
            if (messagesError) {
                console.error('Error loading messages:', messagesError);
                setError('Failed to load chat messages.');
                return;
            }
            
            setMessages(chatMessages || []);
        } catch (error) {
            console.error('Error loading messages:', error);
            setError('Failed to load chat history.');
        }
    }, [readingSessionId]);

    // Initial load of messages
    useEffect(() => {
        if (isOpen && readingSessionId) {
            loadMessages();
        }
    }, [isOpen, readingSessionId, loadMessages]);

    // Subscribe to new messages
    useEffect(() => {
        if (!chatSessionId) return;

        // Set up realtime subscription for new chat messages
        const channel = supabase
            .channel(`chat_updates_${chatSessionId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `session_id=eq.${chatSessionId}`
            }, (payload) => {
                const newMessage = payload.new as Message;
                setMessages(prev => [...prev, newMessage]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chatSessionId]);

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        setLoading(true);
        setError(null);
        
        try {
            // Create a temporary message for immediate UI feedback
            const tempUserMessage: Message = {
                id: `temp-${Date.now()}`,
                role: 'user',
                content: input,
                created_at: new Date().toISOString(),
                session_id: chatSessionId || ''
            };
            
            // Add to UI immediately
            setMessages(prev => [...prev, tempUserMessage]);
            
            // Save input and clear the input field
            const userInput = input;
            setInput('');
            
            // Update the AI service context with the latest chat session ID
            aiService.updateContext({
                chatSessionId,
                currentText,
                currentWord,
                currentSpeed,
                readingSessionId
            });
            
            // Send the message to get AI response
            await aiService.sendMessage(userInput);
            
            // The AI response will come back through the realtime subscription
        } catch (error) {
            console.error('Error in AI chat:', error);
            setError('Failed to get AI response. Please try again.');
            
            // Optionally add an error message to the chat
            setMessages(prev => [
                ...prev, 
                {
                    id: `error-${Date.now()}`,
                    role: 'system',
                    content: 'Sorry, there was an error getting a response. Please try again.',
                    created_at: new Date().toISOString(),
                    session_id: chatSessionId || ''
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateSummary = async () => {
        if (!readingSessionId) return;

        setIsSummarizing(true);
        try {
            const summary = await aiService.generateSummary(readingSessionId);
            
            // Add the summary to the chat
            if (chatSessionId) {
                // Add a system message with the summary
                await supabase.rpc('add_chat_message', {
                    p_session_id: chatSessionId,
                    p_role: 'system',
                    p_content: `📝 Summary: ${summary}`
                });
            } else {
                // Show toast if we can't add to chat
                toast({
                    title: 'Summary',
                    description: summary,
                    status: 'info',
                    duration: 10000,
                    isClosable: true,
                });
            }
        } catch (error) {
            console.error('Error generating summary:', error);
            toast({
                title: 'Error',
                description: 'Failed to generate summary',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
            <ModalOverlay />
            <ModalContent bg={isDarkMode ? 'gray.800' : 'white'}>
                <ModalHeader>Chat with AI</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack
                        spacing={4}
                        align="stretch"
                        h={isEmbedded ? "60vh" : "100%"}
                        bg={isDarkMode ? 'gray.800' : 'white'}
                    >
                        <HStack justify="space-between" p={2}>
                            <Text color={isDarkMode ? 'white' : 'black'}>Chat</Text>
                            <Tooltip label="Generate summary of current context">
                                <IconButton
                                    aria-label="Generate summary"
                                    icon={<EditIcon />}
                                    onClick={handleGenerateSummary}
                                    isLoading={isSummarizing}
                                    colorScheme="blue"
                                    variant="ghost"
                                    size="sm"
                                />
                            </Tooltip>
                        </HStack>
                        
                        {error && (
                            <Box bg="red.100" p={2} borderRadius="md">
                                <Text color="red.800">{error}</Text>
                            </Box>
                        )}
                        
                        <Box
                            flex="1"
                            overflowY="auto"
                            p={4}
                            bg={isDarkMode ? 'gray.700' : 'gray.50'}
                            borderRadius="md"
                            maxH="60vh"
                        >
                            {messages.length === 0 ? (
                                <Text color={isDarkMode ? 'gray.400' : 'gray.500'} textAlign="center">
                                    No messages yet. Start a conversation!
                                </Text>
                            ) : (
                                messages.map((message) => (
                                    <Box
                                        key={message.id}
                                        mb={4}
                                        p={3}
                                        borderRadius="md"
                                        bg={
                                            message.role === 'assistant' 
                                                ? (isDarkMode ? 'gray.600' : 'blue.50') 
                                                : message.role === 'system'
                                                ? (isDarkMode ? 'green.800' : 'green.50')
                                                : 'transparent'
                                        }
                                        color={isDarkMode ? 'white' : 'black'}
                                    >
                                        <Text fontWeight={message.role === 'assistant' ? 'normal' : 'bold'}>
                                            {message.role === 'assistant' ? 'AI' : message.role === 'system' ? 'System' : 'You'}:
                                        </Text>
                                        <Text mt={1}>{message.content}</Text>
                                    </Box>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </Box>

                        <HStack spacing={2} p={2}>
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type your message..."
                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                bg={isDarkMode ? 'gray.700' : 'white'}
                                color={isDarkMode ? 'white' : 'black'}
                                disabled={loading}
                            />
                            <Button
                                onClick={handleSend}
                                isLoading={loading}
                                loadingText="Sending"
                                colorScheme="blue"
                                disabled={!input.trim() || loading}
                            >
                                Send
                            </Button>
                        </HStack>
                    </VStack>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}; 