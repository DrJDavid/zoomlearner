import { supabase } from './supabase';

// Add debug logging to help troubleshoot issues
const DEBUG = true;

function logDebug(...args: any[]) {
    if (DEBUG) {
        console.log('[AI Service Debug]', ...args);
    }
}

interface ChatContext {
    currentText?: string;
    currentWord?: string;
    currentSpeed?: number;
    documentId?: string;
    readingSessionId?: string;
    chatSessionId?: string;
}

interface ChatError {
    message: string;
}

// Define interfaces for quiz analytics
interface QuizAnswer {
    questionId: string;
    selectedOption: number;
    isCorrect: boolean;
}

interface QuizAnalytics {
    readingSessionId: string;
    documentId?: string;
    wordsRead: number;
    totalWords: number;
    readingPositionPercent: number;
    averageSpeed: number;
    quizSessionId: string;
    quizScore: number;
    totalQuestions: number;
    scorePercentage: number;
    quizCreatedAt: string;
    quizCompletedAt: string;
}

export async function sendChatMessage(message: string, context: ChatContext) {
    console.log('Sending chat request with context:', context);
    
    try {
        // Add retry logic for timeouts
        let attempts = 0;
        const maxAttempts = 3;
        let lastError: Error | ChatError | null = null;

        while (attempts < maxAttempts) {
            try {
                let data, error;
                
                // If we have a chat session ID, use get_ai_chat_response_with_context
                if (context.chatSessionId) {
                    console.log('Using existing chat session', context.chatSessionId);
                    ({ data, error } = await supabase.rpc('get_ai_chat_response_with_context', {
                        p_session_id: context.chatSessionId,
                        p_user_message: message,
                        p_system_prompt: 'You are a helpful reading assistant.'
                    }));
                    
                    // This function returns the message ID, so we need to fetch the actual content
                    if (!error && data) {
                        const { data: messageData, error: messageError } = await supabase
                            .from('chat_messages')
                            .select('content')
                            .eq('id', data)
                            .single();
                        
                        if (messageError) {
                            console.error('Error fetching message content:', messageError);
                            lastError = messageError;
                            throw messageError;
                        }
                        
                        return messageData?.content || 'No response from AI';
                    }
                } 
                // If we have a reading session ID but no chat session ID
                else if (context.readingSessionId) {
                    console.log('Creating new chat session for reading', context.readingSessionId);
                    // First create a chat session if needed
                    const { data: chatSession, error: createError } = await supabase.rpc('create_chat_session', {
                        p_reading_session_id: context.readingSessionId,
                        p_title: 'Chat about reading'
                    });
                    
                    if (createError) {
                        console.error('Error creating chat session:', createError);
                        lastError = createError;
                        throw createError;
                    }
                    
                    // Use direct edge function call instead of RPC
                    // This avoids the HTTP extension dependency
                    const response = await supabase.functions.invoke('gemini-chat', {
                        body: {
                            prompt: message,
                            systemPrompt: 'You are a helpful reading assistant.',
                            documentContext: context.currentText || ''
                        }
                    });
                    
                    if (response.error) {
                        console.error('Edge function error:', response.error);
                        lastError = { message: response.error.message || 'Edge function error' };
                        throw new Error(response.error.message);
                    }
                    
                    // Save message and response in chat session
                    if (chatSession) {
                        // Save user message
                        await supabase.from('chat_messages').insert({
                            session_id: chatSession,
                            content: message,
                            role: 'user'
                        });
                        
                        // Save AI response
                        await supabase.from('chat_messages').insert({
                            session_id: chatSession,
                            content: response.data?.text || 'No response from AI',
                            role: 'assistant'
                        });
                    }
                    
                    return response.data?.text || 'No response from AI';
                }
                // Otherwise use direct chat function with any available context
                else {
                    console.log('Using direct chat with no session');
                    // Call the edge function directly through the REST API
                    const response = await supabase.functions.invoke('gemini-chat', {
                        body: {
                            prompt: message,
                            systemPrompt: 'You are a helpful assistant.',
                            documentContext: context.currentText || ''
                        }
                    });
                    
                    if (response.error) {
                        console.error('Edge function error:', response.error);
                        lastError = { message: response.error.message || 'Edge function error' };
                        throw new Error(response.error.message);
                    }
                    
                    return response.data?.text || 'No response from AI';
                }

                if (error) {
                    console.error('Chat error:', error);
                    lastError = error;
                    
                    // If it's a timeout, retry
                    if (error.message?.includes('timeout')) {
                        attempts++;
                        if (attempts < maxAttempts) {
                            console.log(`Retrying chat request (attempt ${attempts + 1}/${maxAttempts})...`);
                            // Wait a bit before retrying
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }
                    }
                    
                    return error.message;
                }

                return data;
            } catch (err) {
                console.error('Unexpected chat error:', err);
                lastError = err as Error;
                
                // If it's a timeout, retry
                if (err instanceof Error && err.message?.includes('timeout')) {
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log(`Retrying chat request (attempt ${attempts + 1}/${maxAttempts})...`);
                        // Wait a bit before retrying
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                }
                
                return err instanceof Error ? err.message : 'An unexpected error occurred';
            }
        }

        // If we get here, all retries failed
        return lastError instanceof Error 
            ? lastError.message 
            : lastError?.message 
            || 'Failed to get response after multiple attempts';

    } catch (err) {
        console.error('Fatal chat error:', err);
        return err instanceof Error ? err.message : 'An unexpected error occurred';
    }
}

export class AIService {
    private context: ChatContext;
    private chatSessionId?: string;

    constructor(context: Partial<ChatContext>) {
        this.context = {
            currentText: context.currentText || '',
            currentWord: context.currentWord || '',
            currentSpeed: context.currentSpeed || 0,
            documentId: context.documentId,
            readingSessionId: context.readingSessionId,
            chatSessionId: context.chatSessionId
        };
    }

    async sendMessage(message: string): Promise<string> {
        try {
            logDebug('Sending chat request with context:', this.context);
            
            // Always use direct edge function instead of SQL RPC
            // This avoids HTTP extension issues
            logDebug('Invoking edge function gemini-chat');
            
            const startTime = Date.now();
            const response = await supabase.functions.invoke('gemini-chat', {
                body: {
                    prompt: message,
                    systemPrompt: 'You are a helpful assistant.',
                    documentContext: this.context.currentText || ''
                }
            });
            
            const elapsedTime = Date.now() - startTime;
            logDebug(`Edge function completed in ${elapsedTime}ms`);
            
            if (response.error) {
                console.error('Edge function error:', response.error);
                logDebug('Full response with error:', response);
                throw new Error(response.error.message || 'Failed to get AI response');
            }
            
            logDebug('Edge function response:', response.data);
            
            const responseText = response.data?.text || 'No response from AI';
            
            // If we have a chat session, save the exchange
            if (this.chatSessionId) {
                logDebug('Saving message to chat session:', this.chatSessionId);
                // Save user message
                await supabase.from('chat_messages').insert({
                    session_id: this.chatSessionId,
                    content: message,
                    role: 'user'
                });
                
                // Save AI response
                await supabase.from('chat_messages').insert({
                    session_id: this.chatSessionId,
                    content: responseText,
                    role: 'assistant'
                });
            }
            
            return responseText;
        } catch (error) {
            console.error('Error in AI response:', error);
            
            // Enhanced error reporting
            let errorMessage = 'Failed to get AI response. Please try again.';
            
            if (error instanceof Error) {
                const isNetworkError = error.message.includes('Failed to fetch') || 
                                      error.message.includes('NetworkError') ||
                                      error.message.includes('network');
                                      
                if (isNetworkError) {
                    errorMessage = 'Network error while connecting to AI service. Please check your connection and try again.';
                } else if (error.message.includes('timeout')) {
                    errorMessage = 'The AI service is taking too long to respond. Please try again later.';
                } else if (error.message.includes('CORS')) {
                    errorMessage = 'CORS error: The AI service is not properly configured for cross-origin requests.';
                }
            }
            
            throw new Error(errorMessage);
        }
    }
    
    async generateSummary(
        readingSessionId: string, 
        length: 'short' | 'medium' | 'long' = 'medium',
        onSummaryCreated?: (summaryId: string) => void
    ): Promise<string> {
        try {
            console.log('Generating summary for reading session', readingSessionId);
            
            // First, fetch the reading session content and document ID in a single query
            const { data: readingData, error: readingError } = await supabase
                .from('reading_sessions')
                .select('text_content, document_id, id')
                .eq('id', readingSessionId)
                .single();
                
            if (readingError) {
                console.error('Error fetching reading content:', readingError);
                throw new Error('Failed to fetch reading content');
            }
            
            if (!readingData?.text_content) {
                console.error('No text content found for reading session');
                throw new Error('No content available to summarize');
            }
            
            // Set a more descriptive default title than just "Summary"
            let documentTitle = 'Reading Summary';
            let documentTitleSource = 'default';
            
            // Try multiple methods to get a better title
            if (readingData.document_id) {
                logDebug('Attempting to fetch document title for ID:', readingData.document_id);
                
                try {
                    // Method 1: Direct document query - most reliable
                    const { data: docData, error: docError } = await supabase
                        .from('documents')
                        .select('title')
                        .eq('id', readingData.document_id)
                        .single();
                    
                    if (docError) {
                        console.error('Error fetching document title:', docError);
                        logDebug('Document fetch error details:', docError);
                    } else if (docData?.title) {
                        documentTitle = docData.title + ' - Summary';
                        documentTitleSource = 'document table';
                        logDebug('Found document title from document table:', documentTitle);
                    }
                } catch (titleError) {
                    console.error('Exception fetching document title:', titleError);
                    // Continue to try other methods
                }
                
                // If we still don't have a good title, try a different query approach
                if (documentTitleSource === 'default') {
                    try {
                        // Method 2: Join through reading_sessions
                        const { data: joinData, error: joinError } = await supabase
                            .from('reading_sessions')
                            .select('documents:document_id(title)')
                            .eq('id', readingSessionId)
                            .single();
                        
                        if (!joinError && joinData?.documents && joinData.documents[0]?.title) {
                            documentTitle = joinData.documents[0].title + ' - Summary';
                            documentTitleSource = 'join query';
                            logDebug('Found document title from join query:', documentTitle);
                        }
                    } catch (joinError) {
                        console.error('Error in title join query:', joinError);
                    }
                }
            } else {
                logDebug('No document_id available for this reading session');
                
                // Try to generate a title from the first few words of the content
                try {
                    // Method 3: Extract title from content
                    const firstFewWords = readingData.text_content
                        .split(' ')
                        .slice(0, 5)
                        .join(' ')
                        .trim();
                    
                    if (firstFewWords && firstFewWords.length > 10) {
                        documentTitle = firstFewWords + '... - Summary';
                        documentTitleSource = 'content excerpt';
                        logDebug('Generated title from content:', documentTitle);
                    } else {
                        // Method 4: Use reading session ID as part of title
                        const shortId = readingSessionId.substring(0, 8);
                        documentTitle = `Reading #${shortId} - Summary`;
                        documentTitleSource = 'session ID';
                        logDebug('Generated title from session ID:', documentTitle);
                    }
                } catch (excerptError) {
                    console.error('Error generating title from content:', excerptError);
                }
            }
            
            logDebug('Final title to use:', documentTitle, '(source:', documentTitleSource, ')');
            
            // Now call the edge function with the content
            logDebug('Calling gemini-summary edge function');
            const response = await supabase.functions.invoke('gemini-summary', {
                body: {
                    content: readingData.text_content,
                    length: length
                }
            });
            
            if (response.error) {
                console.error('Edge function error:', response.error);
                throw new Error(response.error.message || 'Failed to generate summary');
            }
            
            logDebug('Summary generated successfully', response.data);
            
            // If successful, save the summary to the database
            if (response.data?.summary) {
                try {
                    logDebug('Saving summary to database with title:', documentTitle);
                    // Include the title field now that it exists in the schema
                    const summaryData = {
                        content: response.data.summary,
                        reading_session_id: readingSessionId,
                        title: documentTitle // Use our improved title
                    };
                    
                    logDebug('Summary data to save:', summaryData);
                    
                    // Get the current user ID - this is required by the schema
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user?.id) {
                        console.error('No authenticated user found for summary');
                        throw new Error('Authentication required to save summary');
                    }
                    
                    // Add user_id to the data
                    const summaryDataWithUser = {
                        ...summaryData,
                        user_id: user.id
                    };
                    
                    logDebug('Complete summary data to save:', summaryDataWithUser);
                    
                    const { data: savedData, error: saveError } = await supabase
                        .from('summaries')
                        .insert(summaryDataWithUser)
                        .select();
                        
                    if (saveError) {
                        console.error('Error saving summary:', saveError);
                        logDebug('Detailed save error:', saveError);
                        // Don't throw here, we still want to return the summary even if saving fails
                    } else {
                        logDebug('Summary saved successfully:', savedData);
                        // Call the callback if provided with the created summary id
                        if (onSummaryCreated && savedData && savedData[0]?.id) {
                            onSummaryCreated(savedData[0].id);
                        }
                    }
                } catch (dbError) {
                    console.error('Exception during summary save:', dbError);
                    logDebug('Database exception details:', dbError);
                    // Still continue to return the summary
                }
            }
            
            return response.data?.summary || 'No summary was generated.';
        } catch (error) {
            console.error('Error in summary generation:', error);
            throw new Error('Failed to generate summary. Please try again.');
        }
    }
    
    async generateQuiz(
        readingSessionId: string, 
        numQuestions: number = 5, 
        difficulty: 'easy' | 'medium' | 'hard' = 'medium',
        existingQuizSessionId?: string  // Add parameter to accept existing session ID
    ): Promise<any> {
        try {
            console.log('Generating quiz for reading session', readingSessionId);
            logDebug('Starting quiz generation process', { readingSessionId, numQuestions, difficulty });
            
            // First, fetch the reading session content
            const { data: readingData, error: readingError } = await supabase
                .from('reading_sessions')
                .select('text_content')
                .eq('id', readingSessionId)
                .single();
                
            if (readingError) {
                console.error('Error fetching reading content:', readingError);
                throw new Error('Failed to fetch reading content');
            }
            
            if (!readingData?.text_content) {
                console.error('No text content found for reading session');
                throw new Error('No content available for quiz generation');
            }
            
            logDebug('Reading content fetched, length:', readingData.text_content.length);
            
            // Use existing quiz session ID if provided, otherwise create a new one
            let quizSessionId = existingQuizSessionId;
            
            if (!quizSessionId) {
                logDebug('Creating new quiz session');
                const { data: newSessionId, error: createError } = await supabase.rpc('create_quiz_session', {
                    p_reading_session_id: readingSessionId
                });
                
                if (createError) {
                    console.error('Error creating quiz session:', createError);
                    logDebug('Quiz session creation error details:', createError);
                    throw createError;
                }
                
                quizSessionId = newSessionId;
                logDebug('Quiz session created:', quizSessionId);
            } else {
                logDebug('Using existing quiz session:', quizSessionId);
            }
            
            // Limit content size to prevent timeouts
            const limitedContent = readingData.text_content.length > 8000 
                ? readingData.text_content.substring(0, 8000) + '...'
                : readingData.text_content;
            
            logDebug('Calling quiz generator with content length:', limitedContent.length);
            
            // Add a timeout to the function invocation
            const generateWithTimeout = async () => {
                // Create a promise that will reject after 60 seconds
                const timeoutPromise = new Promise<any>((_, reject) => {
                    setTimeout(() => reject(new Error('Quiz generation timed out after 60 seconds')), 60000);
                });
                
                // Race the actual function against the timeout
                return Promise.race([
                    supabase.functions.invoke('gemini-quiz-generator', {
                        body: {
                            content: limitedContent,
                            numQuestions: numQuestions,
                            difficulty: difficulty
                        }
                    }),
                    timeoutPromise
                ]);
            };
            
            // Generate the questions using the edge function with the content
            const response: any = await generateWithTimeout();
            
            logDebug('Quiz generator response received');
            
            if (response.error) {
                console.error('Edge function error:', response.error);
                logDebug('Quiz generation error details:', response.error);
                throw new Error(response.error.message || 'Failed to generate quiz questions');
            }
            
            logDebug('Quiz generator succeeded, questions:', response.data?.questions?.length || 0);
            
            // If we have questions, save them to the database
            const savedQuestions = [];
            if (response.data?.questions && response.data.questions.length > 0) {
                logDebug('Saving questions to database');
                for (const question of response.data.questions) {
                    try {
                        const { data: questionId, error: insertError } = await supabase.rpc('add_quiz_question', {
                            p_quiz_session_id: quizSessionId,
                            p_question_text: question.question,
                            p_options: question.options,
                            p_correct_option: question.correct_option
                        });
                        
                        if (insertError) {
                            console.error('Error saving quiz question:', insertError);
                            logDebug('Error saving question:', question, insertError);
                            // Continue with other questions even if one fails
                        } else {
                            savedQuestions.push(questionId);
                            logDebug('Question saved with ID:', questionId);
                        }
                    } catch (questionError) {
                        console.error('Error processing question:', questionError);
                        logDebug('Question processing error:', question, questionError);
                        // Continue with other questions
                    }
                }
                logDebug('All questions processed. Total saved:', savedQuestions.length);
                
                // Verify questions were actually saved
                if (savedQuestions.length === 0 && response.data.questions.length > 0) {
                    console.error('Failed to save any questions to the database');
                    logDebug('Questions generated but none saved successfully');
                }
            } else {
                logDebug('No questions received from generator');
            }
            
            return { quizSessionId, questions: response.data?.questions || [] };
        } catch (error: any) {
            console.error('Error in quiz generation:', error);
            logDebug('Quiz generation error:', error);
            throw new Error(`Failed to generate quiz: ${error.message || 'Unknown error'}`);
        }
    }

    updateContext(newContext: Partial<ChatContext>) {
        this.context = {
            ...this.context,
            ...newContext
        };
        
        // If chat session ID is provided, update it
        if (newContext.chatSessionId) {
            this.chatSessionId = newContext.chatSessionId;
        }
    }

    /**
     * Updates reading metrics for a reading session, including words read, total words, and reading speed.
     * This data is essential for correlating reading behavior with quiz performance.
     */
    async updateReadingMetrics(
        readingSessionId: string, 
        wordsRead: number, 
        totalWords: number, 
        averageSpeed: number
    ): Promise<boolean> {
        try {
            logDebug('Updating reading metrics:', { readingSessionId, wordsRead, totalWords, averageSpeed });
            
            // Validate inputs to prevent NaN values
            const validWordsRead = isNaN(wordsRead) ? 0 : Math.max(0, wordsRead);
            const validTotalWords = isNaN(totalWords) ? 100 : Math.max(1, totalWords);
            const validSpeed = isNaN(averageSpeed) ? 250 : Math.max(50, averageSpeed);
            
            const { data, error } = await supabase.rpc('update_reading_metrics', {
                p_reading_session_id: readingSessionId,
                p_words_read: validWordsRead,
                p_total_words: validTotalWords,
                p_average_speed: validSpeed
            });
            
            if (error) {
                console.error('Error updating reading metrics:', error);
                throw new Error('Failed to update reading metrics');
            }
            
            logDebug('Reading metrics updated successfully');
            return true;
        } catch (error) {
            console.error('Error updating reading metrics:', error);
            // Don't throw here, just return false - we don't want to break the quiz flow
            return false;
        }
    }

    async submitQuizAnswer(quizSessionId: string, questionId: string, selectedOption: number, isCorrect: boolean): Promise<void> {
        try {
            console.log('Submitting quiz answer:', { quizSessionId, questionId, selectedOption, isCorrect });
            
            // Use the direct RPC call instead of the edge function for better reliability
            const { data, error } = await supabase.rpc('submit_quiz_answer_v2', {
                p_question_id: questionId,
                p_selected_option: selectedOption
            });
            
            if (error) {
                console.error('Error submitting quiz answer:', error);
                throw new Error(error.message || 'Failed to submit quiz answer');
            }
            
            console.log('Quiz answer submitted successfully');
        } catch (error) {
            console.error('Error submitting quiz answer:', error);
            throw new Error('Failed to submit quiz answer');
        }
    }

    async getQuizAnalytics(quizSessionId: string): Promise<QuizAnalytics> {
        try {
            console.log('Getting quiz analytics for:', quizSessionId);
            
            // Try direct RPC first - more reliable than edge function
            try {
                logDebug('Using direct RPC for quiz analytics');
                const { data: rpcData, error: rpcError } = await supabase.rpc('get_quiz_analytics', {
                    p_quiz_session_id: quizSessionId
                });
                
                if (!rpcError && rpcData) {
                    logDebug('Quiz analytics retrieved via RPC:', rpcData);
                    
                    // Use returned data from RPC
                    return {
                        readingSessionId: rpcData.readingSessionId || '',
                        documentId: rpcData.documentId || undefined,
                        wordsRead: isNaN(rpcData.wordsRead) ? 0 : rpcData.wordsRead, 
                        totalWords: isNaN(rpcData.totalWords) ? 100 : rpcData.totalWords,
                        readingPositionPercent: isNaN(rpcData.readingPositionPercent) ? 0 : rpcData.readingPositionPercent,
                        averageSpeed: isNaN(rpcData.averageSpeed) ? 250 : rpcData.averageSpeed,
                        quizSessionId: rpcData.quizSessionId || quizSessionId,
                        quizScore: isNaN(rpcData.quizScore) ? 0 : rpcData.quizScore,
                        totalQuestions: isNaN(rpcData.totalQuestions) ? 5 : rpcData.totalQuestions,
                        scorePercentage: isNaN(rpcData.scorePercentage) ? 0 : rpcData.scorePercentage,
                        quizCreatedAt: rpcData.quizCreatedAt || new Date().toISOString(),
                        quizCompletedAt: rpcData.quizCompletedAt || new Date().toISOString()
                    };
                }
            } catch (rpcErr) {
                console.warn('RPC method failed, falling back to edge function:', rpcErr);
            }
            
            // Fallback to edge function if RPC fails
            logDebug('Falling back to edge function for quiz analytics');
            const response = await supabase.functions.invoke('gemini-quiz-analytics', {
                body: {
                    p_quiz_session_id: quizSessionId
                }
            });
            
            if (response.error) {
                console.error('Edge function error:', response.error);
                throw new Error(response.error.message || 'Failed to get quiz analytics');
            }
            
            console.log('Quiz analytics retrieved successfully:', response.data?.analytics);
            
            // Ensure we have default values if any fields are missing
            const analytics = response.data?.analytics || {};
            return {
                readingSessionId: analytics.readingSessionId || '',
                documentId: analytics.documentId || undefined,
                wordsRead: isNaN(analytics.wordsRead) ? 0 : analytics.wordsRead, 
                totalWords: isNaN(analytics.totalWords) ? 100 : analytics.totalWords,
                readingPositionPercent: isNaN(analytics.readingPositionPercent) ? 0 : analytics.readingPositionPercent,
                averageSpeed: isNaN(analytics.averageSpeed) ? 250 : analytics.averageSpeed,
                quizSessionId: analytics.quizSessionId || quizSessionId,
                quizScore: isNaN(analytics.quizScore) ? 0 : analytics.quizScore,
                totalQuestions: isNaN(analytics.totalQuestions) ? 5 : analytics.totalQuestions,
                scorePercentage: isNaN(analytics.scorePercentage) ? 0 : analytics.scorePercentage,
                quizCreatedAt: analytics.quizCreatedAt || new Date().toISOString(),
                quizCompletedAt: analytics.quizCompletedAt || new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting quiz analytics:', error);
            // Return default values instead of throwing
            return {
                readingSessionId: '',
                documentId: undefined,
                wordsRead: 0,
                totalWords: 100,
                readingPositionPercent: 0,
                averageSpeed: 250,
                quizSessionId: quizSessionId,
                quizScore: 0,
                totalQuestions: 5,
                scorePercentage: 0,
                quizCreatedAt: new Date().toISOString(),
                quizCompletedAt: new Date().toISOString()
            };
        }
    }
    
    async completeQuiz(quizSessionId: string, correctAnswers: number): Promise<boolean> {
        try {
            logDebug('Completing quiz session and saving score:', { quizSessionId, correctAnswers });
            
            // Call the database function to save the quiz result
            const { data, error } = await supabase.rpc('save_quiz_results', {
                p_quiz_session_id: quizSessionId,
                p_correct_answers: correctAnswers
            });
            
            if (error) {
                console.error('Error saving quiz results:', error);
                logDebug('Error details:', error);
                throw new Error(error.message || 'Failed to complete quiz');
            }
            
            logDebug('Quiz completed successfully, score saved');
            return true;
        } catch (error) {
            console.error('Error completing quiz:', error);
            throw new Error('Failed to complete quiz and save score');
        }
    }
    
    // Enhanced method to get quiz answers with analytics
    async getQuizResults(quizSessionId: string): Promise<{
        score: number;
        totalQuestions: number;
        scorePercentage: number;
        answers: QuizAnswer[];
        readingPosition: number;
        readingSpeed: number;
        timeTaken: string; // Add time taken
    }> {
        try {
            logDebug('Fetching quiz results and analytics:', quizSessionId);
            
            // Get the quiz session details
            const { data: quizSession, error: quizError } = await supabase
                .from('quiz_sessions')
                .select('score, reading_session_id, created_at, updated_at')
                .eq('id', quizSessionId)
                .single();
                
            if (quizError) {
                console.error('Error fetching quiz session:', quizError);
                throw new Error('Failed to fetch quiz session details');
            }
            
            // Get the reading session details for speed and position
            const { data: readingSession, error: readingError } = await supabase
                .from('reading_sessions')
                .select('words_read, total_words, average_speed')
                .eq('id', quizSession.reading_session_id)
                .single();
                
            if (readingError) {
                console.error('Error fetching reading session:', readingError);
                throw new Error('Failed to fetch reading metrics');
            }
            
            // Get all questions for this quiz
            const { data: questions, error: questionsError } = await supabase
                .from('quiz_questions')
                .select('id, correct_option')
                .eq('quiz_session_id', quizSessionId);
                
            if (questionsError) {
                console.error('Error fetching quiz questions:', questionsError);
                throw new Error('Failed to fetch quiz questions');
            }
            
            // Get all answers for this quiz
            const { data: answers, error: answersError } = await supabase
                .from('quiz_answers')
                .select('question_id, selected_option, is_correct')
                .eq('user_id', (await supabase.auth.getUser()).data.user?.id);
                
            if (answersError) {
                console.error('Error fetching quiz answers:', answersError);
                throw new Error('Failed to fetch quiz answers');
            }
            
            // Calculate reading position percentage with validation
            const wordsRead = readingSession.words_read || 0;
            const totalWords = readingSession.total_words || 100;
            const readingPosition = totalWords > 0 
                ? (wordsRead / totalWords) * 100 
                : 0;
                
            // Map answers to questions
            const mappedAnswers = answers
                .filter(answer => {
                    // Only include answers for questions in this quiz
                    return questions.some(q => q.id === answer.question_id);
                })
                .map(answer => ({
                    questionId: answer.question_id,
                    selectedOption: answer.selected_option,
                    isCorrect: answer.is_correct
                }));
                
            // Calculate score percentage
            const totalQuestions = questions.length || 5;
            const score = quizSession.score || 0;
            const scorePercentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
            
            // Calculate time taken
            let timeTaken = "Unknown";
            try {
                if (quizSession.created_at && quizSession.updated_at) {
                    const startTime = new Date(quizSession.created_at);
                    const endTime = new Date(quizSession.updated_at);
                    
                    if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
                        const diffMs = endTime.getTime() - startTime.getTime();
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffSecs = Math.floor((diffMs % 60000) / 1000);
                        
                        timeTaken = `${diffMins}m ${diffSecs}s`;
                        
                        if (diffMins === 0) {
                            timeTaken = `${diffSecs}s`;
                        }
                        
                        // Calculate per question time
                        const perQuestion = totalQuestions > 0 ? Math.round((diffMs / 1000) / totalQuestions) : 0;
                        timeTaken += ` (${perQuestion}s per question)`;
                    }
                }
            } catch (timeError) {
                console.error('Error calculating time taken:', timeError);
                timeTaken = "Unknown";
            }
            
            return {
                score,
                totalQuestions,
                scorePercentage,
                answers: mappedAnswers,
                readingPosition,
                readingSpeed: readingSession.average_speed || 250, // Default value if null
                timeTaken,
            };
        } catch (error) {
            console.error('Error getting quiz results:', error);
            // Return default values instead of throwing
            return {
                score: 0,
                totalQuestions: 5,
                scorePercentage: 0,
                answers: [],
                readingPosition: 0,
                readingSpeed: 250, // Default value
                timeTaken: "Unknown",
            };
        }
    }
} 