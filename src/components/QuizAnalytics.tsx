import React, { useEffect, useState } from 'react';
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
    VStack,
    Text,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    StatGroup,
    Box,
    Progress,
    useToast,
} from '@chakra-ui/react';
import { supabase } from '../lib/supabase';

interface QuizAnalytics {
    quiz_session_id: string;
    total_questions: number;
    correct_answers: number;
    accuracy_percentage: number;
    duration_seconds: number;
    overall_accuracy: number;
    total_correct_answers: number;
    total_questions_answered: number;
}

interface QuizAnalyticsProps {
    isOpen: boolean;
    onClose: () => void;
    readingId: string;
    userId: string;
    isDarkMode: boolean;
}

export const QuizAnalytics: React.FC<QuizAnalyticsProps> = ({
    isOpen,
    onClose,
    readingId,
    userId,
    isDarkMode,
}) => {
    const [analytics, setAnalytics] = useState<QuizAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        if (isOpen) {
            fetchAnalytics();
        }
    }, [isOpen]);

    const fetchAnalytics = async () => {
        try {
            // Use the new RPC function that guarantees a single result
            const { data, error } = await supabase
                .rpc('get_quiz_analytics_for_reading', {
                    p_reading_session_id: readingId
                });

            if (error) throw error;
            
            // Check if we got a non-empty response
            if (data && Object.keys(data).length > 0) {
                // Convert from camelCase response to the format component expects
                const formattedData = {
                    quiz_session_id: data.quizSessionId,
                    reading_session_id: data.readingSessionId,
                    document_id: data.documentId,
                    words_read: data.wordsRead,
                    total_words: data.totalWords,
                    reading_position_percent: data.readingPositionPercent,
                    average_speed: data.averageSpeed,
                    quiz_score: data.quizScore,
                    total_questions: data.totalQuestions,
                    score_percentage: data.scorePercentage,
                    quiz_created_at: data.quizCreatedAt,
                    quiz_completed_at: data.quizCompletedAt
                };
                setAnalytics(formattedData);
            } else {
                // No analytics data available
                setAnalytics(null);
            }
        } catch (error) {
            console.error('Error fetching quiz analytics:', error);
            toast({
                title: 'Error loading analytics',
                description: 'Failed to load quiz performance data',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} size="xl">
                <ModalOverlay />
                <ModalContent bg={isDarkMode ? 'gray.800' : 'white'}>
                    <ModalHeader>Quiz Analytics</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack spacing={4} align="center" py={8}>
                            <Text>Loading analytics...</Text>
                            <Progress size="xs" isIndeterminate w="100%" />
                        </VStack>
                    </ModalBody>
                </ModalContent>
            </Modal>
        );
    }

    if (!analytics) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} size="xl">
                <ModalOverlay />
                <ModalContent bg={isDarkMode ? 'gray.800' : 'white'}>
                    <ModalHeader>Quiz Analytics</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <Text>No quiz data available for this reading.</Text>
                    </ModalBody>
                </ModalContent>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
            <ModalOverlay />
            <ModalContent bg={isDarkMode ? 'gray.800' : 'white'}>
                <ModalHeader>Quiz Performance Analytics</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack spacing={6} align="stretch" py={4}>
                        <Box
                            p={6}
                            borderRadius="lg"
                            bg={isDarkMode ? 'gray.700' : 'gray.50'}
                        >
                            <StatGroup>
                                <Stat>
                                    <StatLabel>Latest Quiz Score</StatLabel>
                                    <StatNumber>
                                        {analytics.correct_answers}/{analytics.total_questions}
                                    </StatNumber>
                                    <StatHelpText>
                                        {analytics.accuracy_percentage}% accuracy
                                    </StatHelpText>
                                </Stat>
                                <Stat>
                                    <StatLabel>Time Taken</StatLabel>
                                    <StatNumber>
                                        {Math.round(analytics.duration_seconds / 60)}m {Math.round(analytics.duration_seconds % 60)}s
                                    </StatNumber>
                                    <StatHelpText>
                                        {Math.round(analytics.duration_seconds / analytics.total_questions)}s per question
                                    </StatHelpText>
                                </Stat>
                            </StatGroup>
                        </Box>

                        <Box
                            p={6}
                            borderRadius="lg"
                            bg={isDarkMode ? 'gray.700' : 'gray.50'}
                        >
                            <StatGroup>
                                <Stat>
                                    <StatLabel>Overall Performance</StatLabel>
                                    <StatNumber>
                                        {analytics.total_correct_answers}/{analytics.total_questions_answered}
                                    </StatNumber>
                                    <StatHelpText>
                                        {analytics.overall_accuracy}% lifetime accuracy
                                    </StatHelpText>
                                </Stat>
                            </StatGroup>
                        </Box>

                        <Box>
                            <Text fontSize="sm" color={isDarkMode ? 'gray.400' : 'gray.600'}>
                                Progress
                            </Text>
                            <Progress
                                value={analytics.accuracy_percentage}
                                size="lg"
                                colorScheme={
                                    analytics.accuracy_percentage >= 80
                                        ? 'green'
                                        : analytics.accuracy_percentage >= 60
                                        ? 'yellow'
                                        : 'red'
                                }
                                mt={2}
                            />
                        </Box>
                    </VStack>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}; 