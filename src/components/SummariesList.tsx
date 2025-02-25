import React, { useEffect, useState } from 'react';
import {
    VStack,
    Text,
    Box,
    useToast,
    IconButton,
    HStack,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    MenuDivider,
    Button,
    Badge,
    Divider,
} from '@chakra-ui/react';
import { DeleteIcon, ViewIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { supabase } from '../lib/supabase';

interface Summary {
    id: string;
    content: string;
    text_context: string;
    word_position: number;
    created_at: string;
    summary_type: string;
    reading_session_id: string;
    title?: string;
    length?: string;
}

interface SummariesListProps {
    userId: string;
    isDarkMode: boolean;
    isOpen: boolean;
    onClose: () => void;
    readingId: string;
}

export const SummariesList: React.FC<SummariesListProps> = ({ userId, isDarkMode, isOpen, onClose, readingId }) => {
    const [summaries, setSummaries] = useState<Summary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const toast = useToast();

    useEffect(() => {
        const loadSummaries = async () => {
            try {
                const { data, error } = await supabase
                    .from('summaries')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setSummaries(data || []);
            } catch (error) {
                console.error('Error loading summaries:', error);
                toast({
                    title: 'Error loading summaries',
                    description: error instanceof Error ? error.message : 'Failed to load summaries',
                    status: 'error',
                    duration: 3000,
                    isClosable: true,
                });
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            loadSummaries();
        }
    }, [userId]);

    const handleDelete = async (summaryId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const { error } = await supabase
                .from('summaries')
                .delete()
                .eq('id', summaryId)
                .eq('user_id', userId);

            if (error) throw error;

            setSummaries(summaries.filter(s => s.id !== summaryId));
            toast({
                title: 'Summary deleted',
                status: 'success',
                duration: 2000,
            });
        } catch (error) {
            console.error('Error deleting summary:', error);
            toast({
                title: 'Error deleting summary',
                description: 'Please try again',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        }
    };

    const handleView = (summary: Summary, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedSummary(summary);
        setIsModalOpen(true);
    };

    // Group summaries by reading session
    const groupedSummaries = summaries.reduce((acc, summary) => {
        const sessionId = summary.reading_session_id;
        if (!acc[sessionId]) {
            acc[sessionId] = [];
        }
        acc[sessionId].push(summary);
        return acc;
    }, {} as Record<string, Summary[]>);

    if (!userId) return null;

    return (
        <Box w="100%" maxW="100%">
            <VStack align="stretch" spacing={4} w="100%">
                <Box>
                    <Button
                        rightIcon={<ChevronDownIcon />}
                        colorScheme="teal"
                        variant="outline"
                        isLoading={loading}
                        w="100%"
                        mb={4}
                        size="sm"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                        📝 Summaries
                    </Button>
                    {isDropdownOpen && (
                        <Box
                            bg={isDarkMode ? 'gray.800' : 'white'}
                            borderColor={isDarkMode ? 'gray.600' : 'gray.200'}
                            borderWidth="1px"
                            borderRadius="md"
                            boxShadow="md"
                            mt={2}
                            maxW="100%"
                            maxH="300px"
                            overflowY="auto"
                            zIndex={10}
                            position="absolute"
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
                            {summaries.length === 0 ? (
                                <Box p={2}>
                                    <Text color={isDarkMode ? 'gray.400' : 'gray.500'}>
                                        No summaries yet
                                    </Text>
                                </Box>
                            ) : (
                                summaries.map((summary, index) => (
                                    <React.Fragment key={summary.id}>
                                        {index > 0 && <Divider />}
                                        <Box
                                            p={2}
                                            _hover={{
                                                bg: isDarkMode ? 'gray.700' : 'gray.100'
                                            }}
                                            cursor="pointer"
                                        >
                                            <VStack align="stretch" width="100%" spacing={2}>
                                                <HStack justify="space-between">
                                                    <Text fontSize="sm" color={isDarkMode ? 'gray.400' : 'gray.500'}>
                                                        {new Date(summary.created_at).toLocaleDateString()}
                                                    </Text>
                                                    <Text fontSize="sm" fontWeight="medium" color={isDarkMode ? 'white' : 'black'}>
                                                        {summary.title || 'Untitled Summary'}
                                                    </Text>
                                                </HStack>
                                                <HStack justify="space-between" spacing={2}>
                                                    <Text fontSize="xs" color={isDarkMode ? 'gray.400' : 'gray.500'}>
                                                        {new Date(summary.created_at).toLocaleTimeString()} • {summary.length || 'medium'}
                                                    </Text>
                                                    <HStack spacing={1}>
                                                        <Box
                                                            as="span"
                                                            p={1}
                                                            borderRadius="sm"
                                                            _hover={{ bg: isDarkMode ? 'blue.900' : 'blue.100' }}
                                                            color={isDarkMode ? 'blue.200' : 'blue.500'}
                                                            cursor="pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleView(summary, e);
                                                            }}
                                                        >
                                                            <ViewIcon boxSize="3" />
                                                        </Box>
                                                        <Box
                                                            as="span"
                                                            p={1}
                                                            borderRadius="sm"
                                                            _hover={{ bg: isDarkMode ? 'red.900' : 'red.100' }}
                                                            color={isDarkMode ? 'red.200' : 'red.500'}
                                                            cursor="pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(summary.id, e);
                                                            }}
                                                        >
                                                            <DeleteIcon boxSize="3" />
                                                        </Box>
                                                    </HStack>
                                                </HStack>
                                            </VStack>
                                        </Box>
                                    </React.Fragment>
                                ))
                            )}
                        </Box>
                    )}
                </Box>

                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="xl">
                    <ModalOverlay />
                    <ModalContent bg={isDarkMode ? 'gray.800' : 'white'}>
                        <ModalHeader color={isDarkMode ? 'white' : 'gray.800'}>
                            Summary - {selectedSummary && new Date(selectedSummary.created_at).toLocaleString()}
                        </ModalHeader>
                        <ModalCloseButton color={isDarkMode ? 'white' : 'gray.800'} />
                        <ModalBody pb={6}>
                            {selectedSummary && (
                                <VStack align="stretch" spacing={4}>
                                    <Text color={isDarkMode ? 'white' : 'black'}>
                                        {selectedSummary.content}
                                    </Text>
                                    <Box
                                        p={4}
                                        bg={isDarkMode ? 'gray.700' : 'gray.50'}
                                        borderRadius="md"
                                    >
                                        <Text
                                            color={isDarkMode ? 'gray.300' : 'gray.600'}
                                            fontSize="sm"
                                            fontStyle="italic"
                                        >
                                            Context: {selectedSummary.text_context}
                                        </Text>
                                    </Box>
                                </VStack>
                            )}
                        </ModalBody>
                    </ModalContent>
                </Modal>
            </VStack>
        </Box>
    );
}; 