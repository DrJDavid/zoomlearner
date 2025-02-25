import React, { useState, useCallback, useContext, useEffect } from 'react';
import { Reader } from './components/Reader';
import { supabase } from './lib/supabase';
import { ChakraProvider } from '@chakra-ui/react'
import { ColorModeProvider } from './components/ui/color-mode'
import { theme } from './theme'
import { ReaderProvider, ReaderContext } from './store'

// Temporary verification code - TO BE REMOVED after testing
const ContextVerifier: React.FC = () => {
    console.log('ContextVerifier mounting');
    const readerContext = useContext(ReaderContext);
    console.log('ContextVerifier: Context accessed');
    
    if (!readerContext) {
        console.warn('ReaderContext is null!');
        return null;
    }
    
    console.log('ReaderContext Value:', {
        isPlaying: readerContext.isPlaying,
        speed: readerContext.speed,
        currentWord: readerContext.currentWord,
        text: readerContext.text,
        fontSize: readerContext.fontSize,
        isDarkMode: readerContext.isDarkMode,
        currentWordIndex: readerContext.currentWordIndex,
        hasReaderService: !!readerContext.readerService,
        hasAuthService: !!readerContext.authService
    });
    return null;
};

interface AppProps {
    currentText?: string;
    currentWordIndex?: number;
    documentId?: string;
    readingSessionId?: string;
    userId?: string;
}

export const App: React.FC<AppProps> = ({
    currentText = '',
    currentWordIndex = 0,
    documentId,
    readingSessionId,
    userId
}) => {
    console.log('=== App component mounting ===');
    
    const [currentProgress, setCurrentProgress] = useState({ index: currentWordIndex, total: 0 });
    const [currentSpeed, setCurrentSpeed] = useState(300);
    const [currentFontSize, setCurrentFontSize] = useState(64);

    useEffect(() => {
        console.log('App component mounted with:', {
            currentText,
            currentWordIndex,
            documentId,
            readingSessionId,
            userId
        });
    }, []);

    const handleProgressChange = useCallback((index: number, total: number) => {
        setCurrentProgress({ index, total });
    }, []);

    const handleSpeedChange = useCallback((wpm: number) => {
        setCurrentSpeed(wpm);
    }, []);

    const handleFontSizeChange = useCallback((size: number) => {
        setCurrentFontSize(size);
    }, []);

    const handleSave = useCallback(async () => {
        const session = await supabase.auth.getSession();
        const user = session.data.session?.user;
        
        if (!user) {
            alert('Please sign in to save your progress');
            return;
        }

        try {
            // Calculate content hash
            const contentHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(currentText))
                .then(hash => Array.from(new Uint8Array(hash))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join(''));

            // First insert or update the document
            const { data: doc, error: docError } = await supabase
                .from('documents')
                .upsert({
                    id: documentId,
                    user_id: user.id,
                    title: `Reading ${new Date().toLocaleString()}`,
                    description: `Saved at word ${currentProgress.index + 1} of ${currentProgress.total}`,
                    source_type: 'text',
                    content_hash: contentHash,
                    total_chunks: 1,
                    estimated_reading_time: Math.ceil(currentProgress.total / currentSpeed)
                })
                .select()
                .single();

            if (docError) throw docError;

            // Use the create_reading_session RPC function instead of direct insert
            const { data: sessionId, error: sessionError } = await supabase
                .rpc('create_reading_session', {
                    content: currentText,
                    title: doc.title || 'Reading Session',
                    wpm: currentSpeed,
                    font_size: currentFontSize
                });

            if (sessionError) throw sessionError;
            
            // Update word index if needed
            if (currentProgress.index > 0) {
                await supabase
                    .from('reading_sessions')
                    .update({ current_word_index: currentProgress.index })
                    .eq('id', sessionId);
            }

            // Only show success alert here
            alert('Progress saved successfully!');
        } catch (error) {
            console.error('Error saving progress:', error);
            // Don't show alert here since Reader component will handle it
        }
    }, [currentText, currentProgress, currentSpeed, currentFontSize, documentId]);

    return (
        <ChakraProvider theme={theme}>
            <ColorModeProvider>
                <ReaderProvider initialText={currentText} initialSpeed={currentSpeed} initialFontSize={currentFontSize}>
                    <ContextVerifier />
                    <Reader
                        initialText={currentText}
                        initialSpeed={currentSpeed}
                        initialFontSize={currentFontSize}
                        onProgressChange={handleProgressChange}
                        onSpeedChange={handleSpeedChange}
                        onFontSizeChange={handleFontSizeChange}
                        onSave={handleSave}
                    />
                </ReaderProvider>
            </ColorModeProvider>
        </ChakraProvider>
    );
}; 