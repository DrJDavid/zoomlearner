import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RSVPReader } from '../lib/RSVPReader';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import '../styles/Reader.css';

interface ReaderProps {
    initialText?: string;
    initialSpeed?: number;
    initialFontSize?: number;
    onProgressChange?: (index: number, total: number) => void;
    onSpeedChange?: (wpm: number) => void;
    onFontSizeChange?: (size: number) => void;
    onSave?: () => void;
}

export const Reader: React.FC<ReaderProps> = ({
    initialText = '',
    initialSpeed = 300,
    initialFontSize = 64,
    onProgressChange,
    onSpeedChange,
    onFontSizeChange,
    onSave
}) => {
    console.log('Reader component rendering');

    const [text, setText] = useState(initialText);
    const [speed, setSpeed] = useState(initialSpeed);
    const [fontSize, setFontSize] = useState(initialFontSize);
    const [currentWord, setCurrentWord] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    
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

    return (
        <div 
            ref={containerRef}
            className={`reader-container ${isDarkMode ? 'dark-mode' : ''} ${isFullscreen ? 'fullscreen' : ''}`}
            tabIndex={-1}
            autoFocus
            onBlur={(e) => {
                // Prevent focus from leaving the container unless going to an input
                if (!(e.relatedTarget instanceof HTMLInputElement) && 
                    !(e.relatedTarget instanceof HTMLTextAreaElement)) {
                    e.currentTarget.focus();
                }
            }}
            onKeyDown={(e: React.KeyboardEvent) => {
                // Log every key press
                console.log('Key pressed:', {
                    code: e.code,
                    key: e.key,
                    target: (e.target as HTMLElement).tagName,
                    activeElement: document.activeElement?.tagName
                });

                // Don't handle if we're in an input field or textarea
                if ((e.target as HTMLElement).tagName === 'INPUT' || 
                    (e.target as HTMLElement).tagName === 'TEXTAREA') {
                    return;
                }

                // Handle shortcuts
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
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            handleFullscreenToggle();
                        }
                        break;

                    case 'KeyS':
                        if ((e.ctrlKey || e.metaKey) && onSave) {
                            e.preventDefault();
                            if (isPlaying) handlePause();
                            onSave();
                        }
                        break;
                }
            }}
            style={{ outline: 'none' }}
            role="application"
            aria-label="RSVP Reader"
        >
            {/* Add keyboard shortcuts info panel */}
            <div className="keyboard-shortcuts-info" style={{
                position: 'fixed',
                top: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                fontSize: '12px',
                zIndex: 9999
            }}>
                <div>Keyboard Shortcuts:</div>
                <div>Space: Play/Pause</div>
                <div>↑/↓: Speed ±25 WPM</div>
                <div>←/→: Navigate words</div>
                <div>Ctrl+F: Fullscreen</div>
                <div>Ctrl+S: Save</div>
                <div style={{marginTop: '10px'}}>
                    Status: {isPlaying ? 'Playing' : 'Paused'} at {speed} WPM
                </div>
            </div>
            
            <div className="debug-info" style={{ 
                position: 'fixed', 
                top: 0, 
                right: 0, 
                background: 'rgba(0,0,0,0.8)', 
                color: 'white', 
                padding: '10px', 
                fontSize: '12px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
            }}>
                <div>Speed: {speed} WPM</div>
                <div>Playing: {isPlaying ? 'Yes' : 'No'}</div>
                <div>Has Text: {text.trim() ? 'Yes' : 'No'}</div>
                <div>Has Reader: {readerRef.current ? 'Yes' : 'No'}</div>
                <div>Word Count: {readerRef.current?.getWords().length ?? 0}</div>
                <div>Current Word: {currentWord}</div>
            </div>
            <div className="controls">
                <div className="control-group">
                    <button onClick={() => document.getElementById('fileInput')?.click()}>
                        Open File
                    </button>
                    <input
                        id="fileInput"
                        type="file"
                        accept=".txt,.pdf,.docx,.doc,.epub,.odt,.rtf"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                </div>

                <div className="control-group">
                    <button onClick={handleStart} style={{ display: isPlaying ? 'none' : 'inline-block' }}>
                        Start
                    </button>
                    <button onClick={handlePause} style={{ display: isPlaying ? 'inline-block' : 'none' }}>
                        Pause
                    </button>
                </div>

                <div className="control-group">
                    <label>
                        WPM:
                        <input
                            type="number"
                            min="60"
                            max="1000"
                            value={speed}
                            onChange={(e) => handleSpeedChange(parseInt(e.target.value))}
                        />
                    </label>
                </div>

                <div className="control-group">
                    <label>
                        Font Size:
                        <input
                            type="range"
                            min="16"
                            max="128"
                            value={fontSize}
                            onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
                        />
                        <span className="font-size-value">{fontSize}px</span>
                    </label>
                </div>

                <div className="control-group">
                    <button onClick={() => setIsDarkMode(!isDarkMode)}>
                        {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    <button onClick={handleFullscreenToggle}>
                        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    </button>
                    {onSave && (
                        <button onClick={onSave} disabled={!user}>
                            Save Bookmark
                        </button>
                    )}
                </div>
            </div>

            <div className="word-display">
                <div className="word-container" style={{ fontSize: `${fontSize}px` }}>
                    {currentWord}
                </div>
            </div>

            <textarea
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    if (readerRef.current) {
                        readerRef.current.loadContent(e.target.value);
                    }
                }}
                placeholder="Enter or paste text here..."
            />
        </div>
    );
}; 