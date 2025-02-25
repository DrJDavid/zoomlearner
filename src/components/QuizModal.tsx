import React, { useState, useEffect } from 'react';
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
    ModalFooter,
    Button,
    VStack,
    Radio,
    RadioGroup,
    Text,
    Progress,
    useToast,
    Box,
    Heading,
    Stat,
    StatLabel,
    StatNumber,
    StatGroup,
    StatHelpText,
    Divider,
    HStack,
    Tooltip,
    CircularProgress,
    CircularProgressLabel,
} from '@chakra-ui/react';
import { supabase } from '../lib/supabase';
import { AIService } from '../lib/ai';

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correct_option: number;
    explanation?: string;
}

interface QuizSessionStatus {
    status: string;
    total_questions: number;
    generated_questions: number;
    error_message: string | null;
}

interface QuizModalProps {
    isOpen: boolean;
    onClose: () => void;
    readingId: string;
    userId: string;
    textContent: string;
    isDarkMode: boolean;
}

// Add interface for analytics data
interface QuizResultsData {
    score: number;
    totalQuestions: number;
    scorePercentage: number;
    answers: Array<{
        questionId: string;
        selectedOption: number;
        isCorrect: boolean;
    }>;
    readingPosition: number;
    readingSpeed: number;
    timeTaken: string; // Add time taken field
}

// Quiz Analytics Component
const QuizAnalytics: React.FC<{
    quizSessionId: string;
    readingId: string;
    isDarkMode: boolean;
}> = ({ quizSessionId, readingId, isDarkMode }) => {
    const [analytics, setAnalytics] = useState<QuizResultsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                setLoading(true);
                const aiService = new AIService({ readingSessionId: readingId });
                const results = await aiService.getQuizResults(quizSessionId);
                setAnalytics(results);
                setError(null);
            } catch (err) {
                console.error("Error fetching quiz analytics:", err);
                setError(err instanceof Error ? err.message : "Failed to load analytics");
            } finally {
                setLoading(false);
            }
        };
        
        fetchAnalytics();
    }, [quizSessionId, readingId]);
    
    if (loading) {
        return (
            <Box textAlign="center" py={4}>
                <Text mb={4}>Loading analytics...</Text>
                <Progress isIndeterminate colorScheme="blue" size="sm" />
            </Box>
        );
    }
    
    if (error) {
        return (
            <Box bg={isDarkMode ? "red.900" : "red.50"} p={4} borderRadius="md">
                <Text color={isDarkMode ? "red.200" : "red.500"}>Error: {error}</Text>
            </Box>
        );
    }
    
    if (!analytics) {
        return (
            <Box bg={isDarkMode ? "gray.700" : "gray.100"} p={4} borderRadius="md">
                <Text>No analytics available for this quiz.</Text>
            </Box>
        );
    }
    
    return (
        <Box>
            <Heading size="md" mb={4}>Performance Analysis</Heading>
            
            <StatGroup mb={6}>
                <Stat>
                    <StatLabel>Quiz Score</StatLabel>
                    <StatNumber>{analytics.score}/{analytics.totalQuestions}</StatNumber>
                    <StatHelpText>{analytics.scorePercentage.toFixed(0)}%</StatHelpText>
                </Stat>
                
                <Stat>
                    <StatLabel>Reading Position</StatLabel>
                    <StatNumber>{analytics.readingPosition.toFixed(0)}%</StatNumber>
                    <StatHelpText>of document read</StatHelpText>
                </Stat>
                
                <Stat>
                    <StatLabel>Reading Speed</StatLabel>
                    <StatNumber>{analytics.readingSpeed.toFixed(0)}</StatNumber>
                    <StatHelpText>words per minute</StatHelpText>
                </Stat>
            </StatGroup>
            
            <Divider mb={4} />
            
            {/* Add time taken section */}
            <Heading size="sm" mb={3}>Quiz Time</Heading>
            <Box textAlign="center" mb={6}>
                <Text fontSize="xl" fontWeight="bold">{analytics.timeTaken}</Text>
                <Text fontSize="sm" color={isDarkMode ? "gray.400" : "gray.600"}>
                    Time to complete quiz
                </Text>
            </Box>
            
            <Divider mb={4} />
            
            <Heading size="sm" mb={3}>Retention Analysis</Heading>
            <HStack spacing={8} justify="center" mb={6}>
                <Tooltip label="Quiz score percentage">
                    <Box textAlign="center">
                        <CircularProgress 
                            value={analytics.scorePercentage} 
                            color="green.400" 
                            size="100px"
                        >
                            <CircularProgressLabel>
                                {analytics.scorePercentage.toFixed(0)}%
                            </CircularProgressLabel>
                        </CircularProgress>
                        <Text mt={2}>Retention Score</Text>
                    </Box>
                </Tooltip>
                
                <Box textAlign="center" px={6}>
                    <Heading size="md">
                        {analytics.readingSpeed > 400 ? "⚠️ " : "✅ "}
                        {getRetentionAnalysis(analytics.readingSpeed, analytics.scorePercentage)}
                    </Heading>
                    <Text mt={2} fontSize="sm" maxW="250px">
                        {getRetentionTips(analytics.readingSpeed, analytics.scorePercentage)}
                    </Text>
                </Box>
            </HStack>
        </Box>
    );
};

// Helper functions for analytics
function getRetentionAnalysis(speed: number, score: number): string {
    if (speed > 500 && score < 60) {
        return "Reading too fast";
    } else if (speed > 400 && score < 80) {
        return "Speed may affect retention";
    } else if (speed < 150 && score < 60) {
        return "Slow reading, low retention";
    } else if (score > 80) {
        return "Excellent retention";
    } else if (score > 60) {
        return "Good retention";
    } else {
        return "Needs improvement";
    }
}

function getRetentionTips(speed: number, score: number): string {
    if (speed > 500 && score < 60) {
        return "Try slowing down your reading pace to improve comprehension and retention.";
    } else if (speed > 400 && score < 80) {
        return "Consider adjusting your reading speed for better comprehension of complex material.";
    } else if (speed < 150 && score < 60) {
        return "Try active reading techniques like highlighting or summarizing to improve engagement.";
    } else if (score > 80) {
        return "Great job! Your reading technique is working well for this material.";
    } else {
        return "Try reviewing key concepts or taking notes while reading to improve retention.";
    }
}

export const QuizModal: React.FC<QuizModalProps> = ({
    isOpen,
    onClose,
    readingId,
    userId,
    textContent,
    isDarkMode,
}) => {
    const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
    const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);
    const [selectedAnswer, setSelectedAnswer] = useState<string>('');
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [showResults, setShowResults] = useState(false);
    const [quizSessionId, setQuizSessionId] = useState<string>('');
    const [sessionStatus, setSessionStatus] = useState<QuizSessionStatus | null>(null);
    const toast = useToast();

    useEffect(() => {
        if (isOpen) {
            startQuiz();
        }
    }, [isOpen]);

    // Effect to poll quiz session status
    useEffect(() => {
        if (!quizSessionId || showResults) {
            console.log('Not polling: quizSessionId is empty or showing results');
            return;
        }
        
        // Only poll if we're waiting for questions
        if (sessionStatus?.status === "completed" && !isLoading) {
            console.log('Not polling: quiz generation already completed');
            return;
        }

        console.log('Starting to poll for quiz questions with session ID:', quizSessionId);
        
        const pollStatus = async () => {
            try {
                console.log('Polling for quiz questions, session ID:', quizSessionId);
                
                // First check if the session ID is valid
                if (!quizSessionId) {
                    console.warn('No session ID available for polling, attempting to retrieve one');
                    
                    // Try to get the latest quiz session for this reading
                    const { data: latestSessionId, error: sessionError } = await supabase
                        .rpc('get_latest_quiz_session', {
                            p_reading_session_id: readingId
                        });
                    
                    if (sessionError || !latestSessionId) {
                        console.error('Failed to retrieve latest quiz session');
                        throw new Error('No valid quiz session found');
                    }
                    
                    // Update the session ID state and continue with this ID
                    console.log('Retrieved latest quiz session ID:', latestSessionId);
                    setQuizSessionId(latestSessionId);
                    
                    // Wait for state update and poll again
                    setTimeout(pollStatus, 500);
                    return;
                }
                
                const { data: questionsData, error: statusError } = await supabase
                    .rpc('get_quiz_questions', {
                        p_quiz_session_id: quizSessionId
                    });

                if (statusError) {
                    console.error('Error polling for questions:', statusError);
                    
                    // Check for GROUP BY error specifically
                    if (statusError.message && statusError.message.includes('GROUP BY')) {
                        console.error('PostgreSQL GROUP BY error detected');
                        setSessionStatus({
                            ...sessionStatus!,
                            status: "error",
                            error_message: "Database query error. Please run the required migrations."
                        });
                        return;
                    }
                    
                    throw statusError;
                }
                
                // questionsData is now a JSON array
                const questions = Array.isArray(questionsData) ? questionsData : [];
                console.log('Poll returned:', questions.length, 'questions');
                
                if (questions && questions.length > 0) {
                    console.log('Questions found:', questions.length);
                    
                    // Process the first question
                    const firstQuestion = questions[0];
                    const formattedQuestion: QuizQuestion = {
                        id: firstQuestion.id,
                        question: firstQuestion.question,
                        options: Array.isArray(firstQuestion.options) 
                            ? firstQuestion.options 
                            : JSON.parse(typeof firstQuestion.options === 'string' 
                                ? firstQuestion.options 
                                : JSON.stringify(firstQuestion.options)),
                        correct_option: firstQuestion.correct_option,
                        explanation: '' // No explanation in the database yet
                    };
                    
                    setCurrentQuestion(formattedQuestion);
                    setIsLoading(false);
                    
                    setSessionStatus({
                        ...sessionStatus!,
                        status: "ready",
                        total_questions: questions.length,
                        generated_questions: questions.length
                    });
                    
                    return;
                } else if (sessionStatus?.status === "error") {
                    // Don't continue polling if we have an error
                    console.log('Not continuing to poll due to error state');
                    return;
                } else {
                    // If we're still waiting for questions, continue polling
                    console.log('No questions found yet, will poll again');
                    setTimeout(pollStatus, 2000);  // Poll every 2 seconds
                }
            } catch (error) {
                console.error('Error polling quiz status:', error);
                setSessionStatus({
                    ...sessionStatus!,
                    status: "error",
                    error_message: "Failed to load quiz questions."
                });
                
                toast({
                    title: 'Error Loading Quiz',
                    description: 'Unable to load quiz questions. Please try again.',
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
            }
        };

        pollStatus();
    }, [quizSessionId, showResults, sessionStatus?.status]);

    const startQuiz = async () => {
        setIsLoading(true);
        setCurrentQuestion(null);
        setCurrentQuestionNumber(1);
        setSelectedAnswer('');
        setIsAnswered(false);
        setScore(0);
        setShowResults(false);
        setSessionStatus({
            status: "initializing",
            total_questions: 5,
            generated_questions: 0,
            error_message: null
        });
        
        try {
            // Create an instance of AIService
            const aiService = new AIService({
                currentText: textContent,
                readingSessionId: readingId
            });
            
            // Update reading metrics before starting the quiz
            // This ensures we have accurate tracking data for correlating reading with quiz performance
            try {
                // Calculate total words based on text content
                const totalWords = textContent.trim().split(/\s+/).filter(Boolean).length;
                
                // Get the actual reading position from props or state
                // This should come from your reader component that tracks reading progress
                // If not available, use a reasonable default but log a warning
                let readingProgress = 0;
                
                // Try to get the actual reading progress from the reading system
                try {
                    // This is a placeholder - you need to replace with your actual reading progress tracking
                    // For example, if you track scroll position in a reader component:
                    // readingProgress = readerState.scrollPercentage;
                    
                    // For demo purposes or testing, you can use localStorage to simulate saved progress
                    const savedProgress = localStorage.getItem(`reading_progress_${readingId}`);
                    if (savedProgress) {
                        readingProgress = parseFloat(savedProgress);
                    }
                } catch (progressError) {
                    console.warn('Could not get reading progress:', progressError);
                }
                
                // Use the actual reading progress or fallback to a more conservative estimate
                const readingPercentage = readingProgress > 0 ? readingProgress : 0.5; 
                const wordsRead = Math.round(totalWords * readingPercentage);
                
                // Calculate average reading speed based on time spent reading
                // If we don't have actual time data, use a formula or range based on user behavior
                let averageReadingSpeedWPM = 0;
                
                // Try to get or calculate the actual reading speed
                try {
                    // This is a placeholder - you need to replace with your actual reading speed tracking
                    // For example, if you track time spent reading:
                    // const timeSpentReading = (endTime - startTime) / 60000; // in minutes
                    // averageReadingSpeedWPM = wordsRead / timeSpentReading;
                    
                    // For demo purposes, try to get from localStorage
                    const readingStartTime = localStorage.getItem(`reading_start_time_${readingId}`);
                    if (readingStartTime) {
                        const startTime = new Date(readingStartTime).getTime();
                        const endTime = new Date().getTime();
                        const minutesSpent = (endTime - startTime) / 60000;
                        
                        if (minutesSpent > 0 && wordsRead > 0) {
                            averageReadingSpeedWPM = Math.round(wordsRead / minutesSpent);
                        }
                    }
                } catch (speedError) {
                    console.warn('Could not calculate reading speed:', speedError);
                }
                
                // Use calculated speed or fall back to a reasonable default based on user type
                // Average adult reads at ~200-250 WPM
                averageReadingSpeedWPM = averageReadingSpeedWPM > 0 ? averageReadingSpeedWPM : 200;
                
                console.log('Updating reading metrics with:', {
                    wordsRead,
                    totalWords,
                    averageReadingSpeedWPM,
                    readingPercentage
                });
                
                // Update the metrics in the database
                await aiService.updateReadingMetrics(
                    readingId,
                    wordsRead,
                    totalWords,
                    averageReadingSpeedWPM
                );
                
                console.log('Updated reading metrics for quiz analytics');
            } catch (metricsError) {
                console.error('Error updating reading metrics:', metricsError);
                // Continue with quiz creation anyway
            }
            
            // First create a quiz session
            const { data: sessionId, error: sessionError } = await supabase.rpc('create_quiz_session', {
                p_reading_session_id: readingId
            });
            
            if (sessionError) throw sessionError;
            
            console.log('Created quiz session with ID:', sessionId);
            // Make sure to set the session ID state before proceeding
            setQuizSessionId(sessionId);
            
            setSessionStatus({
                status: "generating",
                total_questions: 5,
                generated_questions: 0,
                error_message: null
            });
            
            // Now use the AIService to generate quiz questions
            
            try {
                // Generate quiz questions via the AI service
                // Pass the existing session ID to use instead of creating a new one
                const quizResult = await aiService.generateQuiz(readingId, 5, 'medium', sessionId);
                
                console.log('Quiz generation completed:', quizResult);
                
                // Double check that we have the session ID
                if (!sessionId) {
                    console.error('Quiz session ID is null after generation');
                    throw new Error('Failed to create quiz session');
                }
                
                setSessionStatus({
                    status: "completed",
                    total_questions: quizResult.questions?.length || 0,
                    generated_questions: quizResult.questions?.length || 0,
                    error_message: null
                });
                
                // Wait a short time to ensure DB operations complete
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Now we can fetch the first question, using the stored session ID
                console.log('Ready to fetch question using session ID:', sessionId);
                fetchQuestion(1);
                
            } catch (aiError) {
                console.error('Error generating quiz questions:', aiError);
                setSessionStatus({
                    status: "error",
                    total_questions: 5,
                    generated_questions: 0,
                    error_message: aiError instanceof Error ? aiError.message : 'Failed to generate quiz questions'
                });
                
                toast({
                    title: 'Quiz Generation Error',
                    description: aiError instanceof Error ? aiError.message : 'Failed to generate quiz questions',
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
                setIsLoading(false);
            }
            
        } catch (error) {
            console.error('Error starting quiz:', error);
            setSessionStatus({
                status: "error",
                total_questions: 0,
                generated_questions: 0,
                error_message: error instanceof Error ? error.message : 'Failed to start quiz'
            });
            
            toast({
                title: 'Quiz Error',
                description: 'Failed to start quiz. Please try again.',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
            setIsLoading(false);
        }
    };

    const fetchQuestion = async (questionNumber: number) => {
        try {
            if (!quizSessionId) {
                console.error("Quiz session ID is missing when fetching questions");
                
                // Try to retrieve the latest quiz session for this reading
                const { data: latestSessionId, error: sessionError } = await supabase
                    .rpc('get_latest_quiz_session', {
                        p_reading_session_id: readingId
                    });
                
                if (sessionError || !latestSessionId) {
                    toast({
                        title: 'Error Loading Quiz',
                        description: 'Could not find your quiz session. Please try again.',
                        status: 'error',
                        duration: 5000,
                        isClosable: true,
                    });
                    return;
                }
                
                // We found a valid session ID, let's use it
                console.log('Retrieved latest quiz session ID:', latestSessionId);
                setQuizSessionId(latestSessionId);
                
                // Wait a moment for state to update
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Now use this session ID
                console.log(`Fetching question ${questionNumber} with recovered session ID: ${latestSessionId}`);
                
                const { data: questionsData, error: questionError } = await supabase
                    .rpc('get_quiz_questions', {
                        p_quiz_session_id: latestSessionId
                    });
                
                if (questionError) {
                    console.error('Error fetching questions with recovered session ID:', questionError);
                    throw questionError;
                }
                
                // Process the data as before
                const questions = Array.isArray(questionsData) ? questionsData : [];
                console.log(`Fetched ${questions.length} questions with recovered ID`);
                
                if (questions && questions.length >= questionNumber) {
                    const rawQuestion = questions[questionNumber - 1];
                    const formattedQuestion: QuizQuestion = {
                        id: rawQuestion.id,
                        question: rawQuestion.question,
                        options: Array.isArray(rawQuestion.options) 
                            ? rawQuestion.options 
                            : JSON.parse(typeof rawQuestion.options === 'string' 
                                ? rawQuestion.options 
                                : JSON.stringify(rawQuestion.options)),
                        correct_option: rawQuestion.correct_option,
                        explanation: ''
                    };
                    setCurrentQuestion(formattedQuestion);
                    setIsLoading(false);
                } else {
                    throw new Error('Question not found with recovered session ID');
                }
                
                return;
            }
            
            console.log(`Fetching question ${questionNumber} for quiz session ${quizSessionId}`);
            
            const { data: questionsData, error: questionError } = await supabase
                .rpc('get_quiz_questions', {
                    p_quiz_session_id: quizSessionId
                });

            if (questionError) {
                console.error('Error fetching questions:', questionError);
                throw questionError;
            }
            
            // Parse the questionsData as a JSON array if needed
            const questions = Array.isArray(questionsData) ? questionsData : [];
            console.log(`Fetched ${questions.length} questions for quiz`);
            
            if (questions && questions.length >= questionNumber) {
                console.log(`Setting current question to #${questionNumber}`);
                // Process the question at the specified index
                const rawQuestion = questions[questionNumber - 1];
                const formattedQuestion: QuizQuestion = {
                    id: rawQuestion.id,
                    question: rawQuestion.question,
                    options: Array.isArray(rawQuestion.options) 
                        ? rawQuestion.options 
                        : JSON.parse(typeof rawQuestion.options === 'string' 
                            ? rawQuestion.options 
                            : JSON.stringify(rawQuestion.options)),
                    correct_option: rawQuestion.correct_option,
                    explanation: '' // No explanation in the database yet
                };
                setCurrentQuestion(formattedQuestion);
            } else {
                console.error(`Question #${questionNumber} not found in fetched questions`);
                throw new Error('Question not found');
            }
            
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching question:', error);
            toast({
                title: 'Error Fetching Question',
                description: error instanceof Error ? error.message : 'Failed to fetch the question. Please try again.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
            
            // Set loading to false to prevent UI from getting stuck
            setIsLoading(false);
        }
    };

    const handleAnswer = async () => {
        if (!currentQuestion) return;
        
        // Check if the selected answer matches the correct option text
        const correctAnswerText = currentQuestion.options[currentQuestion.correct_option];
        const isCorrect = selectedAnswer === correctAnswerText;
        
        if (isCorrect) {
            setScore(score + 1);
        }

        // Find the index of the selected answer
        const selectedIndex = currentQuestion.options.findIndex(option => option === selectedAnswer);
        
        // Save the response using the AIService method
        try {
            const aiService = new AIService({
                readingSessionId: readingId,
            });
            
            // Using the proper submit_quiz_answer function to save to quiz_answers table
            await supabase.rpc('submit_quiz_answer_v2', {
                p_question_id: currentQuestion.id,
                p_selected_option: selectedIndex
            });
        } catch (error) {
            console.error('Error saving quiz response:', error);
        }

        setIsAnswered(true);
    };

    const handleNext = () => {
        const nextQuestionNumber = currentQuestionNumber + 1;
        
        if (nextQuestionNumber <= 5) {
            setCurrentQuestionNumber(nextQuestionNumber);
            setSelectedAnswer('');
            setIsAnswered(false);
            setIsLoading(true);
            fetchQuestion(nextQuestionNumber);
        } else {
            finishQuiz();
        }
    };

    const finishQuiz = async () => {
        try {
            // Create instance of AIService
            const aiService = new AIService({
                readingSessionId: readingId,
            });
            
            // Save quiz results using the completeQuiz method
            await aiService.completeQuiz(quizSessionId, score);
            
            setShowResults(true);
            
            // Optionally, fetch and display analytics
            try {
                const quizResults = await aiService.getQuizResults(quizSessionId);
                console.log('Quiz Analytics:', quizResults);
                // You can use these results to display additional metrics
            } catch (analyticsError) {
                console.error('Error fetching quiz analytics:', analyticsError);
            }
        } catch (error) {
            console.error('Error saving quiz results:', error);
            toast({
                title: 'Error Saving Results',
                description: 'Failed to save quiz results. Your progress may not be recorded.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const handleClose = () => {
        setCurrentQuestion(null);
        setCurrentQuestionNumber(1);
        setSelectedAnswer('');
        setIsAnswered(false);
        setScore(0);
        setShowResults(false);
        setSessionStatus(null);
        onClose();
    };

    if (isLoading || (sessionStatus?.status !== 'ready' && sessionStatus?.status !== 'completed')) {
        return (
            <Modal isOpen={isOpen} onClose={handleClose} size="xl">
                <ModalOverlay />
                <ModalContent bg={isDarkMode ? 'gray.800' : 'white'}>
                    <ModalHeader>
                        {sessionStatus?.status === 'error' ? 'Error Creating Quiz' : 'Preparing Quiz'}
                    </ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack spacing={4} align="center" py={8}>
                            {sessionStatus?.status === 'error' ? (
                                <Box textAlign="center" py={4}>
                                    <Text color="red.500" fontSize="lg" mb={4}>
                                        {sessionStatus.error_message || 'An error occurred while generating the quiz.'}
                                    </Text>
                                    <Text>
                                        This may happen with very long or complex text. 
                                        Try again with a shorter selection or try a different reading.
                                    </Text>
                                </Box>
                            ) : (
                                <>
                                    <Text>
                                        {sessionStatus?.status === 'initializing' && 'Initializing quiz...'}
                                        {sessionStatus?.status === 'generating' && 'Generating questions based on your text...'}
                                        {sessionStatus?.status === 'completed' && 'Loading quiz questions...'}
                                    </Text>
                                    <Progress 
                                        size="xs" 
                                        w="100%" 
                                        isIndeterminate={sessionStatus?.status !== 'generating'}
                                        value={70} 
                                        colorScheme="blue"
                                    />
                                    <Text color="gray.500" fontSize="sm" mt={4}>
                                        {sessionStatus?.status === 'generating' && 
                                          'This may take up to 30 seconds for longer texts.'}
                                    </Text>
                                </>
                            )}
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button 
                            onClick={handleClose}
                            colorScheme={sessionStatus?.status === 'error' ? "red" : "blue"}
                        >
                            {sessionStatus?.status === 'error' ? 'Close' : 'Cancel'}
                        </Button>
                        {sessionStatus?.status === 'error' && (
                            <Button 
                                ml={3} 
                                colorScheme="blue" 
                                onClick={startQuiz}
                            >
                                Try Again
                            </Button>
                        )}
                    </ModalFooter>
                </ModalContent>
            </Modal>
        );
    }

    if (showResults) {
        return (
            <Modal isOpen={isOpen} onClose={handleClose} size="xl">
                <ModalOverlay />
                <ModalContent bg={isDarkMode ? 'gray.800' : 'white'}>
                    <ModalHeader>Quiz Results</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack spacing={6} align="stretch" py={4}>
                            <Heading size="md" textAlign="center">
                                Quiz Complete!
                            </Heading>
                            <Box 
                                p={5} 
                                bg={isDarkMode ? "gray.700" : "white"} 
                                borderRadius="md"
                                shadow="md"
                            >
                                <VStack spacing={4} align="center">
                                    <Heading size="md">Quiz Results</Heading>
                                    <StatGroup w="100%">
                                        <Stat>
                                            <StatLabel>Score</StatLabel>
                                            <StatNumber>{score} / 5</StatNumber>
                                            <StatHelpText>{(score / 5 * 100).toFixed(0)}%</StatHelpText>
                                        </Stat>
                                    </StatGroup>
                                    
                                    <Divider my={4} />
                                    
                                    <QuizAnalytics 
                                        quizSessionId={quizSessionId} 
                                        readingId={readingId}
                                        isDarkMode={isDarkMode}
                                    />
                                </VStack>
                            </Box>
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button onClick={handleClose}>Close</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        );
    }

    if (!currentQuestion) {
        return null;
    }

    const answers = [...currentQuestion.options];
    const correctAnswerText = answers[currentQuestion.correct_option];

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="xl">
            <ModalOverlay />
            <ModalContent bg={isDarkMode ? 'gray.800' : 'white'}>
                <ModalHeader>
                    Question {currentQuestionNumber} of 5
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack spacing={6} align="stretch">
                        <Box>
                            <Text fontSize="lg" fontWeight="medium">
                                {currentQuestion.question}
                            </Text>
                        </Box>
                        <RadioGroup
                            value={selectedAnswer}
                            onChange={setSelectedAnswer}
                            isDisabled={isAnswered}
                        >
                            <VStack align="stretch" spacing={3}>
                                {answers.map((answer, index) => (
                                    <Radio
                                        key={index}
                                        value={answer}
                                        colorScheme={
                                            isAnswered
                                                ? index === currentQuestion.correct_option
                                                    ? 'green'
                                                    : answer === selectedAnswer && index !== currentQuestion.correct_option
                                                    ? 'red'
                                                    : 'gray'
                                                : 'blue'
                                        }
                                    >
                                        <Text
                                            color={
                                                isAnswered && index === currentQuestion.correct_option
                                                    ? 'green.500'
                                                    : undefined
                                            }
                                        >
                                            {answer}
                                        </Text>
                                    </Radio>
                                ))}
                            </VStack>
                        </RadioGroup>
                        
                        {isAnswered && (
                            <Box
                                p={4}
                                bg={isDarkMode ? 'gray.700' : 'gray.50'}
                                borderRadius="md"
                            >
                                <Text fontWeight="medium" mb={2}>
                                    {selectedAnswer === correctAnswerText ? 
                                        "Correct!" : 
                                        `Incorrect. The correct answer is: ${correctAnswerText}`}
                                </Text>
                                {currentQuestion.explanation && (
                                    <Text>{currentQuestion.explanation}</Text>
                                )}
                            </Box>
                        )}
                    </VStack>
                </ModalBody>
                <ModalFooter>
                    <Progress
                        value={(currentQuestionNumber / 5) * 100}
                        size="xs"
                        w="100%"
                        mb={4}
                    />
                    {!isAnswered ? (
                        <Button
                            colorScheme="blue"
                            onClick={handleAnswer}
                            isDisabled={!selectedAnswer}
                        >
                            Submit Answer
                        </Button>
                    ) : (
                        <Button 
                            colorScheme="green" 
                            onClick={handleNext}
                        >
                            {currentQuestionNumber < 5 ? 'Next Question' : 'Finish Quiz'}
                        </Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}; 