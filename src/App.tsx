import React, { useState, useCallback } from 'react';
import { Reader } from './components/Reader';
import { supabase } from './lib/supabase';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react'
import { theme } from './theme' // we'll create this next

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
    console.log('App component rendering');
    const [currentProgress, setCurrentProgress] = useState({ index: currentWordIndex, total: 0 });
    const [currentSpeed, setCurrentSpeed] = useState(300);
    const [currentFontSize, setCurrentFontSize] = useState(64);

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

            // Then insert the reading session
            const { error: sessionError } = await supabase
                .from('reading_sessions')
                .insert([{
                    user_id: user.id,
                    document_id: doc.id,
                    current_word_index: currentProgress.index,
                    text_content: currentText,
                    wpm: currentSpeed,
                    font_size: currentFontSize
                }]);

            if (sessionError) throw sessionError;

            alert('Progress saved successfully!');
        } catch (error) {
            console.error('Error saving progress:', error);
            alert('Failed to save progress. Please try again.');
        }
    }, [currentText, currentProgress, currentSpeed, currentFontSize, documentId]);

    return (
        <ChakraProvider theme={theme}>
            <ColorModeScript initialColorMode={theme.config.initialColorMode} />
            <Reader
                initialText={currentText}
                initialSpeed={currentSpeed}
                initialFontSize={currentFontSize}
                onProgressChange={handleProgressChange}
                onSpeedChange={handleSpeedChange}
                onFontSizeChange={handleFontSizeChange}
                onSave={handleSave}
            />
        </ChakraProvider>
    );
}; 