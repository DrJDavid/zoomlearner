import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RSVPReader } from '../lib/RSVPReader';
import { supabase, getUserPreferences, saveUserPreferences, saveReading } from '../lib/supabase';
import { AuthModal } from './AuthModal';
import type { User } from '@supabase/supabase-js';
import { useColorMode, useToast, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, Input, Button, VStack } from '@chakra-ui/react';
import '../styles/Reader.css';
import { SavedReadings } from './SavedReadings';
import { debounce } from 'lodash';

interface ReaderProps {
    initialText?: string;
    initialSpeed?: number;
    initialFontSize?: number;
    onProgressChange?: (index: number, total: number) => void;
    onSpeedChange?: (wpm: number) => void;
    onFontSizeChange?: (size: number) => void;
    onSave?: () => void;
}

// Create debounced save function outside component to prevent recreation
const debouncedSave = debounce(async (
    user: User,
    text: string,
    readerRef: React.RefObject<RSVPReader>,
    speed: number,
    fontSize: number,
    setIsSaving: (saving: boolean) => void,
    onSave?: () => void
) => {
    if (!user || !text.trim() || !readerRef.current) {
        setIsSaving(false);
        return;
    }

    try {
        const { error } = await saveReading(
            user.id, 
            text, 
            readerRef.current.getCurrentIndex(), 
            speed, 
            fontSize
        );

        if (error) throw error;
        
        // Call onSave callback if provided, but don't show alert here
        onSave?.();
    } catch (err) {
        console.error('Error saving reading:', err);
        alert('Failed to save reading. Please try again.');
    } finally {
        setIsSaving(false);
    }
}, 1000, { leading: true, trailing: false });  // Only trigger on the first call within the window

export const Reader: React.FC<ReaderProps> = ({
    initialText = '',
    initialSpeed = 300,
    initialFontSize = 64,
    onProgressChange,
    onSpeedChange,
    onFontSizeChange,
    onSave
}) => {
    const { setColorMode } = useColorMode();
    const toast = useToast();

    console.log('Reader component rendering');

    const [text, setText] = useState(initialText);
    const [speed, setSpeed] = useState(initialSpeed);
    const [fontSize, setFontSize] = useState(initialFontSize);
    const [currentWord, setCurrentWord] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const [currentText, setCurrentText] = useState(initialText);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    
    const readerRef = useRef<RSVPReader | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log('Reader component mounted');
        
        // Initialize reader
        const reader = new RSVPReader();
        console.log('Reader instance created:', reader);
        readerRef.current = reader;

        // Set up event handlers
        reader.onTextChange = (newText: string) => {
            console.log('Text changed:', newText.substring(0, 50) + '...');
            setText(newText);
        };

        reader.onProgressChange = (index: number, total: number) => {
            console.log('Progress changed:', { index, total });
            setCurrentWord(reader.getCurrentWord());
            onProgressChange?.(index, total);
        };

        // Load initial text if provided
        if (initialText) {
            console.log('Loading initial text');
            reader.loadContent(initialText);
        }

        // Set initial speed
        reader.setSpeed(initialSpeed);

        // Check auth state
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user ?? null);
        });

        return () => {
            console.log('Reader component unmounting');
            subscription.unsubscribe();
        };
    }, []);

    // Load user preferences
    useEffect(() => {
        const loadUserPreferences = async () => {
            if (!user) return;
            
            try {
                const { data, error } = await getUserPreferences(user.id);
                if (error) throw error;
                
                if (data) {
                    setSpeed(data.wpm || initialSpeed);
                    setFontSize(data.font_size || initialFontSize);
                    if (typeof data.dark_mode === 'boolean') {
                        setIsDarkMode(data.dark_mode);
                    }
                }
            } catch (err) {
                console.error('Error loading preferences:', err);
            }
        };

        loadUserPreferences();
    }, [user]);

    // Save preferences when they change
    useEffect(() => {
        const savePreferences = async () => {
            if (!user) return;

            try {
                await saveUserPreferences(user.id, {
                    wpm: speed,
                    font_size: fontSize,
                    dark_mode: isDarkMode
                });
            } catch (err) {
                console.error('Error saving preferences:', err);
            }
        };

        // Debounce the save operation to avoid too many requests
        const timeoutId = setTimeout(savePreferences, 500);
        return () => clearTimeout(timeoutId);
    }, [user, speed, fontSize, isDarkMode]);

    // Update Chakra theme when dark mode changes
    useEffect(() => {
        setColorMode(isDarkMode ? 'dark' : 'light');
    }, [isDarkMode, setColorMode]);

    const handleStart = useCallback(() => {
        if (!readerRef.current) return;
        
        if (!text.trim()) {
            alert('Please load or enter some text first');
            return;
        }
        
        if (!readerRef.current.getWords().length) {
            readerRef.current.loadContent(text);
        }
        
        readerRef.current.start();
        setIsPlaying(true);
        setCurrentWord(readerRef.current.getCurrentWord());
    }, [text]);

    const handlePause = useCallback(() => {
        if (!readerRef.current) return;
        readerRef.current.pause();
        setIsPlaying(false);
        setCurrentWord(readerRef.current.getCurrentWord());
    }, []);

    const handleSpeedChange = useCallback((newSpeed: number) => {
        if (!readerRef.current) return;
        readerRef.current.setSpeed(newSpeed);
        setSpeed(newSpeed);
        onSpeedChange?.(newSpeed);
    }, [onSpeedChange]);

    const handleFontSizeChange = useCallback((newSize: number) => {
        setFontSize(newSize);
        onFontSizeChange?.(newSize);
    }, [onFontSizeChange]);

    const handleFullscreenToggle = useCallback(async () => {
        if (!containerRef.current) return;

        try {
            if (!isFullscreen) {
                await containerRef.current.requestFullscreen();
                containerRef.current.classList.add('fullscreen');
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.error('Fullscreen error:', error);
        }
    }, [isFullscreen]);

    // Handle fullscreen changes from browser
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
            if (!document.fullscreenElement && containerRef.current) {
                containerRef.current.classList.remove('fullscreen');
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && readerRef.current) {
            try {
                await readerRef.current.loadFile(file);
            } catch (error) {
                console.error('Error loading file:', error);
                alert('Error loading file. Please try again.');
            }
        }
    };

    const handleUrlLoad = async (url: string) => {
        if (!url.trim() || !readerRef.current) return;

        try {
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const response = await fetch(proxyUrl + encodeURIComponent(url));
            if (!response.ok) throw new Error('Failed to fetch URL');
            
            const text = await response.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            
            // Remove scripts, styles, and other non-content elements
            const elementsToRemove = doc.querySelectorAll('script, style, nav, header, footer, iframe, [role="navigation"]');
            elementsToRemove.forEach(el => el.remove());
            
            // Try to find main content
            const mainContent = 
                doc.querySelector('main') || 
                doc.querySelector('article') || 
                doc.querySelector('.content') || 
                doc.querySelector('.main-content') ||
                doc.body;
                
            const cleanText = mainContent ? mainContent.textContent?.trim() || '' : '';
            readerRef.current.loadContent(cleanText);
        } catch (error) {
            console.error('Error loading URL:', error);
            alert('Failed to load URL. Please check the URL and try again.');
        }
    };

    const handleSignIn = useCallback(() => {
        setIsAuthModalOpen(true);
    }, []);

    const handleSignOut = useCallback(async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Failed to sign out. Please try again.');
        }
    }, []);

    const handleSaveReading = useCallback(() => {
        if (!user) {
            toast({
                title: 'Please sign in',
                description: 'You need to be signed in to save readings',
                status: 'warning',
                duration: 3000,
                isClosable: true,
            });
            return;
        }
        
        // Open the save modal to get the title
        setCurrentText(text);
        setCurrentWordIndex(readerRef.current?.getCurrentIndex() || 0);
        setIsSaveModalOpen(true);
    }, [user, text, toast]);

    const handleLoadReading = (content: string, position: number, wpm?: number, fontSize?: number) => {
        if (!readerRef.current) return;
        
        readerRef.current.loadContent(content);
        readerRef.current.setCurrentIndex(position);
        setCurrentWord(readerRef.current.getCurrentWord());
        
        if (wpm) {
            handleSpeedChange(wpm);
        }
        
        if (fontSize) {
            handleFontSizeChange(fontSize);
        }
    };

    // Add keyboard shortcut for saving
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (user) {
                    setIsSaveModalOpen(true);
                } else {
                    toast({
                        title: 'Please sign in',
                        description: 'You need to be signed in to save readings',
                        status: 'warning',
                        duration: 3000,
                        isClosable: true,
                    });
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [user]);

    const handleSave = async () => {
        if (!user || !readerRef.current) return;

        try {
            setIsSaving(true);
            const currentText = text;
            const currentWordIndex = readerRef.current.getCurrentIndex();
            // Generate a title from the first few words or use default
            const generateTitle = () => {
                if (!currentText || currentText.trim().length === 0) {
                    return new Date().toLocaleString();
                }
                const words = currentText.trim().split(' ');
                const titleWords = words.slice(0, 5).join(' ');
                return titleWords.length > 0 ? `${titleWords}...` : new Date().toLocaleString();
            };
            
            const saveTitle = generateTitle();
            
            try {
                const { error } = await saveReading(
                    user.id,
                    currentText,
                    currentWordIndex,
                    readerRef.current.getSpeed(),
                    fontSize,
                    saveTitle
                );

                if (error) throw error;

                toast({
                    title: 'Reading saved',
                    status: 'success',
                    duration: 2000,
                });

                if (onSave) onSave();
                setIsSaveModalOpen(false);
                setSaveTitle('');
            } catch (err) {
                console.error('Error saving reading:', err);
                toast({
                    title: 'Error saving reading',
                    description: 'Please try again',
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
            }
        } catch (err) {
            console.error('Error saving reading:', err);
            toast({
                title: 'Error saving reading',
                description: 'Please try again',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <AuthModal 
                isOpen={isAuthModalOpen} 
                onClose={() => setIsAuthModalOpen(false)}
                isDarkMode={isDarkMode}
            />
            <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)}>
                <ModalOverlay />
                <ModalContent bg={isDarkMode ? 'gray.800' : 'white'}>
                    <ModalHeader color={isDarkMode ? 'white' : 'gray.800'}>
                        Save Reading
                    </ModalHeader>
                    <ModalCloseButton color={isDarkMode ? 'white' : 'gray.800'} />
                    <ModalBody pb={6}>
                        <VStack spacing={4}>
                            <Input
                                placeholder="Enter a title for this reading"
                                value={saveTitle}
                                onChange={(e) => setSaveTitle(e.target.value)}
                                color={isDarkMode ? 'white' : 'black'}
                                autoFocus
                            />
                            <Button colorScheme="blue" onClick={handleSave} w="100%">
                                Save
                            </Button>
                        </VStack>
                    </ModalBody>
                </ModalContent>
            </Modal>
            <div 
                ref={containerRef}
                className={`reader-container ${isDarkMode ? 'dark-mode' : ''} ${isFullscreen ? 'fullscreen' : ''}`}
                tabIndex={-1}
                autoFocus
                onKeyDown={(e: React.KeyboardEvent) => {
                    // Don't handle if we're in an input field
                    if ((e.target as HTMLElement).tagName === 'INPUT') {
                        return;
                    }

                    // Add Ctrl+S handler
                    if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSaveReading();
                        return;
                    }

                    switch (e.code) {
                        case 'Space':
                            e.preventDefault();
                            if (!readerRef.current) return;
                            
                            if (isPlaying) {
                                handlePause();
                            } else {
                                handleStart();
                            }
                            break;

                        case 'ArrowUp':
                            e.preventDefault();
                            handleSpeedChange(Math.min(1000, speed + 25));
                            break;

                        case 'ArrowDown':
                            e.preventDefault();
                            handleSpeedChange(Math.max(60, speed - 25));
                            break;

                        case 'ArrowLeft':
                            e.preventDefault();
                            if (!readerRef.current) return;
                            const prevIndex = readerRef.current.getCurrentIndex();
                            if (prevIndex > 0) {
                                if (isPlaying) handlePause();
                                readerRef.current.setCurrentIndex(prevIndex - 1);
                                setCurrentWord(readerRef.current.getCurrentWord());
                            }
                            break;

                        case 'ArrowRight':
                            e.preventDefault();
                            if (!readerRef.current) return;
                            const nextIndex = readerRef.current.getCurrentIndex();
                            const words = readerRef.current.getWords();
                            if (nextIndex < words.length - 1) {
                                if (isPlaying) handlePause();
                                readerRef.current.setCurrentIndex(nextIndex + 1);
                                setCurrentWord(readerRef.current.getCurrentWord());
                            }
                            break;

                        case 'KeyF':
                            e.preventDefault();
                            handleFullscreenToggle();
                            break;
                    }
                }}
            >
                <div className={`reader-controls ${isFullscreen ? 'hidden' : ''}`}>
                    <button 
                        className="auth-button" 
                        onClick={user ? handleSignOut : handleSignIn}
                    >
                        {user ? 'Sign Out' : 'Sign In'}
                    </button>

                    {user && text && (
                        <button 
                            className="save-button"
                            onClick={handleSaveReading}
                        >
                            Save Reading
                        </button>
                    )}

                    <div className="control-group">
                        <label className="file-label" htmlFor="fileInput">📂 Open File</label>
                        <input
                            id="fileInput"
                            type="file"
                            className="file-input"
                            onChange={handleFileChange}
                            accept=".txt,.pdf,.doc,.docx,.epub,.rtf,.odt"
                        />
                    </div>

                    <div className="control-group">
                        <label>Size: {fontSize}px</label>
                        <input
                            type="range"
                            min="32"
                            max="128"
                            value={fontSize}
                            onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                        />
                    </div>

                    <div className="control-group">
                        <label>WPM:</label>
                        <input
                            type="number"
                            min="60"
                            max="1000"
                            value={speed}
                            onChange={(e) => handleSpeedChange(Number(e.target.value))}
                        />
                    </div>

                    <div className="button-group">
                        <button onClick={handleStart} disabled={isPlaying}>Start</button>
                        <button onClick={handlePause} disabled={!isPlaying}>Pause</button>
                        <button onClick={handleFullscreenToggle}>
                            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        </button>
                        <button onClick={() => setIsDarkMode(!isDarkMode)}>
                            {isDarkMode ? '☀️' : '🌙'}
                        </button>
                    </div>

                    <div className="control-group">
                        <label>Load from URL:</label>
                        <input
                            type="text"
                            className="url-input"
                            placeholder="Enter URL to read..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleUrlLoad((e.target as HTMLInputElement).value);
                                }
                            }}
                        />
                    </div>

                    <div className="control-group">
                        <label>Paste Text:</label>
                        <textarea
                            className="text-input"
                            placeholder="Paste or type text to read..."
                            rows={5}
                            onChange={(e) => {
                                if (readerRef.current) {
                                    readerRef.current.loadContent(e.target.value);
                                }
                            }}
                        />
                    </div>

                    <div className="keyboard-shortcuts">
                        <ul>
                            <li>Space: Play/Pause</li>
                            <li>↑/↓: Adjust speed</li>
                            <li>←/→: Navigate words</li>
                            <li>F: Toggle fullscreen</li>
                        </ul>
                    </div>

                    {user && (
                        <>
                            <SavedReadings 
                                userId={user.id}
                                onSelect={handleLoadReading}
                                isDarkMode={isDarkMode}
                            />
                        </>
                    )}
                </div>

                <div className="word-display" style={{ fontSize: `${fontSize}px` }}>
                    {currentWord || 'Ready'}
                </div>
            </div>
        </>
    );
}; 