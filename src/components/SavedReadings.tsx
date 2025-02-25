import React, { useEffect, useState } from 'react';
import { supabase, getSavedReadings, deleteSavedReading, getReadingContent } from '../lib/supabase';
import {
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    MenuDivider,
    Button,
    Text,
    HStack,
    VStack,
    IconButton,
    useToast,
    Box,
} from '@chakra-ui/react';
import { ChevronDownIcon, DeleteIcon, EditIcon, QuestionIcon, StarIcon, ChatIcon } from '@chakra-ui/icons';
import '../styles/SavedReadings.css';
import { SummariesList } from './SummariesList';
import { QuizModal } from './QuizModal';
import { QuizAnalytics } from './QuizAnalytics';
import { ChatModal } from './ChatModal';
import { AIService } from '../lib/ai';

interface SavedReading {
    id: string;
    text_content?: string;
    storage_url?: string;
    current_word_index: number;
    wpm: number;
    font_size?: number;
    created_at: string;
    document_id?: string;
    title?: string;
    documents?: {
        title: string;
    };
}

interface SavedReadingsProps {
    userId: string;
    onSelect: (text: string, position: number, wpm?: number, fontSize?: number) => void;
    isDarkMode: boolean;
}

export const SavedReadings: React.FC<SavedReadingsProps> = ({ userId, onSelect, isDarkMode }) => {
    const [readings, setReadings] = useState<SavedReading[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReading, setSelectedReading] = useState<SavedReading | null>(null);
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [isQuizOpen, setIsQuizOpen] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryContent, setSummaryContent] = useState('');
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (!userId) return;
        
        const fetchReadings = async () => {
            try {
                const { data, error } = await getSavedReadings(userId);
                if (error) throw error;
                setReadings(data || []);
            } catch (err) {
                console.error('Error fetching readings:', err);
                toast({
                    title: 'Error loading readings',
                    description: err instanceof Error ? err.message : 'Failed to load saved readings',
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
            } finally {
                setLoading(false);
            }
        };

        fetchReadings();
    }, [userId, toast]);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent menu from closing
        if (!userId) return;
        
        try {
            const { error } = await deleteSavedReading(userId, id);
            if (error) throw error;
            setReadings(readings.filter(reading => reading.id !== id));
            toast({
                title: 'Reading deleted',
                status: 'success',
                duration: 2000,
            });
        } catch (err) {
            console.error('Error deleting reading:', err);
            toast({
                title: 'Error deleting reading',
                description: 'Please try again',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const handleGenerateSummary = async (reading: SavedReading) => {
        setSelectedReading(reading);
        setIsSummarizing(true);
        setIsSummaryOpen(true);

        try {
            // Use the AIService to generate summary instead of direct RPC call
            const aiService = new AIService({
                currentText: reading.text_content || '',
                readingSessionId: reading.id
            });
            
            // Pass a callback to refresh summaries after one is created
            const summary = await aiService.generateSummary(
                reading.id, 
                'medium',
                (summaryId) => {
                    // Force refresh of summaries list by closing and reopening
                    setIsSummaryOpen(false);
                    setTimeout(() => {
                        setIsSummaryOpen(true);
                    }, 100);
                    
                    toast({
                        title: 'Summary Saved',
                        description: 'Your summary has been saved and is now available.',
                        status: 'success',
                        duration: 2000,
                        isClosable: true,
                    });
                }
            );
            
            setSummaryContent(summary);
            
            toast({
                title: 'Summary Generated',
                description: 'Summary has been successfully generated.',
                status: 'success',
                duration: 3000,
                isClosable: true,
            });
        } catch (error) {
            console.error('Error generating summary:', error);
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to generate summary',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleOpenQuiz = (reading: SavedReading) => {
        setSelectedReading(reading);
        setIsQuizOpen(true);
    };

    const handleOpenAnalytics = (reading: SavedReading) => {
        setSelectedReading(reading);
        setIsAnalyticsOpen(true);
    };

    const handleOpenChat = (reading: SavedReading) => {
        setSelectedReading(reading);
        setIsChatOpen(true);
    };

    const handleSelectReading = async (reading: SavedReading) => {
        try {
            // If we already have text_content, use it directly
            if (reading.text_content) {
                onSelect(
                    reading.text_content,
                    reading.current_word_index,
                    reading.wpm,
                    reading.font_size
                );
                return;
            }
            
            // Otherwise, fetch content from storage
            const { content, error } = await getReadingContent(reading.id);
            
            if (error) {
                toast({
                    title: "Error loading reading content",
                    description: "Could not load the reading content",
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
                return;
            }
            
            if (!content) {
                toast({
                    title: "No content found",
                    description: "This reading has no content",
                    status: "warning",
                    duration: 5000,
                    isClosable: true,
                });
                return;
            }
            
            onSelect(
                content,
                reading.current_word_index,
                reading.wpm,
                reading.font_size
            );
        } catch (error) {
            console.error("Error loading reading content:", error);
            toast({
                title: "Error",
                description: "An unexpected error occurred",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    };

    if (!userId) return null;
    
    return (
        <Box w="100%" maxW="100%">
            <VStack align="stretch" spacing={4} w="100%">
                <Menu>
                    <MenuButton
                        as={Button}
                        rightIcon={<ChevronDownIcon />}
                        colorScheme="blue"
                        variant="outline"
                        isLoading={loading}
                        w="100%"
                        mb={4}
                        size="sm"
                    >
                        📚 Saved Readings
                    </MenuButton>
                    <MenuList
                        bg={isDarkMode ? 'gray.800' : 'white'}
                        borderColor={isDarkMode ? 'gray.600' : 'gray.200'}
                        maxW="100%"
                        maxH="300px"
                        overflowY="auto"
                        sx={{
                            '&::-webkit-scrollbar': {
                                width: '8px',
                                borderRadius: '8px',
                                backgroundColor: isDarkMode ? 'gray.700' : 'gray.100',
                            },
                            '&::-webkit-scrollbar-thumb': {
                                backgroundColor: isDarkMode ? 'gray.600' : 'gray.300',
                                borderRadius: '8px',
                            },
                        }}
                    >
                        {readings.length === 0 ? (
                            <MenuItem isDisabled>
                                <Text color={isDarkMode ? 'gray.400' : 'gray.500'}>
                                    No saved readings yet
                                </Text>
                            </MenuItem>
                        ) : (
                            readings.map((reading, index) => (
                                <React.Fragment key={reading.id}>
                                    {index > 0 && <MenuDivider />}
                                    <Box
                                        p={2}
                                        _hover={{
                                            bg: isDarkMode ? 'gray.700' : 'gray.100'
                                        }}
                                        role="menuitem"
                                        cursor="pointer"
                                    >
                                        <VStack align="stretch" width="100%" spacing={2}>
                                            <HStack justify="space-between">
                                                <Text fontSize="sm" color={isDarkMode ? 'gray.400' : 'gray.500'}>
                                                    {new Date(reading.created_at).toLocaleDateString()}
                                                </Text>
                                                <Text fontSize="sm" fontWeight="medium" color={isDarkMode ? 'white' : 'black'}>
                                                    {reading.title || 'Untitled'}
                                                </Text>
                                            </HStack>
                                            <HStack justify="space-between" spacing={2}>
                                                <Text fontSize="xs" color={isDarkMode ? 'gray.400' : 'gray.500'}>
                                                    {new Date(reading.created_at).toLocaleTimeString()} • {reading.wpm} WPM
                                                </Text>
                                                <HStack spacing={1}>
                                                    <Box
                                                        as="span"
                                                        p={1}
                                                        borderRadius="sm"
                                                        _hover={{ bg: isDarkMode ? 'yellow.900' : 'yellow.100' }}
                                                        color={isDarkMode ? 'yellow.200' : 'yellow.500'}
                                                        cursor="pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenAnalytics(reading);
                                                        }}
                                                    >
                                                        <StarIcon boxSize="3" />
                                                    </Box>
                                                    <Box
                                                        as="span"
                                                        p={1}
                                                        borderRadius="sm"
                                                        _hover={{ bg: isDarkMode ? 'purple.900' : 'purple.100' }}
                                                        color={isDarkMode ? 'purple.200' : 'purple.500'}
                                                        cursor="pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenQuiz(reading);
                                                        }}
                                                    >
                                                        <QuestionIcon boxSize="3" />
                                                    </Box>
                                                    <Box
                                                        as="span"
                                                        p={1}
                                                        borderRadius="sm"
                                                        _hover={{ bg: isDarkMode ? 'blue.900' : 'blue.100' }}
                                                        color={isDarkMode ? 'blue.200' : 'blue.500'}
                                                        cursor="pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenChat(reading);
                                                        }}
                                                    >
                                                        <ChatIcon boxSize="3" />
                                                    </Box>
                                                    <Box
                                                        as="span"
                                                        p={1}
                                                        borderRadius="sm"
                                                        _hover={{ bg: isDarkMode ? 'green.900' : 'green.100' }}
                                                        color={isDarkMode ? 'green.200' : 'green.500'}
                                                        cursor="pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleGenerateSummary(reading);
                                                        }}
                                                    >
                                                        <EditIcon boxSize="3" />
                                                    </Box>
                                                    <Box
                                                        as="span"
                                                        p={1}
                                                        borderRadius="sm"
                                                        _hover={{ bg: isDarkMode ? 'red.900' : 'red.100' }}
                                                        color={isDarkMode ? 'red.200' : 'red.500'}
                                                        cursor="pointer"
                                                        onClick={(e) => handleDelete(reading.id, e)}
                                                    >
                                                        <DeleteIcon boxSize="3" />
                                                    </Box>
                                                </HStack>
                                            </HStack>
                                            <Box
                                                as="div"
                                                fontSize="xs"
                                                py={1}
                                                px={2}
                                                bg="blue.500"
                                                color="white"
                                                borderRadius="md"
                                                textAlign="center"
                                                fontWeight="medium"
                                                cursor="pointer"
                                                _hover={{ bg: "blue.600" }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelectReading(reading);
                                                }}
                                            >
                                                Load Reading
                                            </Box>
                                        </VStack>
                                    </Box>
                                </React.Fragment>
                            ))
                        )}
                    </MenuList>
                </Menu>

                {/* Only show this when not in modal mode */}
                {!selectedReading && (
                    <SummariesList userId={userId} isDarkMode={isDarkMode} />
                )}
            </VStack>

            {selectedReading && (
                <>
                    <QuizModal
                        isOpen={isQuizOpen}
                        onClose={() => setIsQuizOpen(false)}
                        readingId={selectedReading.id}
                        userId={userId}
                        textContent={selectedReading.text_content}
                        isDarkMode={isDarkMode}
                    />
                    <QuizAnalytics
                        isOpen={isAnalyticsOpen}
                        onClose={() => setIsAnalyticsOpen(false)}
                        readingId={selectedReading.id}
                        userId={userId}
                        isDarkMode={isDarkMode}
                    />
                    <SummariesList
                        isOpen={isSummaryOpen}
                        onClose={() => {
                            setIsSummaryOpen(false);
                            setSelectedReading(null); // Clear selection when closing
                        }}
                        readingId={selectedReading.id}
                        userId={userId}
                        isDarkMode={isDarkMode}
                    />
                    <ChatModal
                        isOpen={isChatOpen}
                        onClose={() => setIsChatOpen(false)}
                        isDarkMode={isDarkMode}
                        currentText={selectedReading.text_content}
                        currentWord={selectedReading.text_content.split(' ')[selectedReading.current_word_index]}
                        currentSpeed={selectedReading.wpm}
                        documentId={selectedReading.document_id}
                        readingSessionId={selectedReading.id}
                    />
                </>
            )}
        </Box>
    );
}; 