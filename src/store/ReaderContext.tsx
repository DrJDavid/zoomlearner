import React, { createContext, useState, useRef, useEffect, ReactNode } from 'react';
import { ReaderService } from '../services/ReaderService';
import { AuthService } from '../services/AuthService';
import { User } from '@supabase/supabase-js';

// Define the context type - describes the values provided by the context
interface ReaderContextType {
  readerService: ReaderService | null;
  authService: AuthService | null;
  isPlaying: boolean;
  speed: number;
  currentWord: string;
  text: string;
  fontSize: number;
  isDarkMode: boolean;
  currentWordIndex: number;
  toggleDarkMode: () => void;
  setFontSize: (size: number) => void;
  loadTextContent: (text: string) => void;
  playReader: () => void;
  pauseReader: () => void;
  setReaderSpeed: (wpm: number) => void;
}

// Create the ReaderContext with a default value of null
export const ReaderContext = createContext<ReaderContextType | null>(null);

// Define the ReaderProvider component props
interface ReaderProviderProps {
  children: ReactNode;
  initialText?: string;
  initialSpeed?: number;
  initialFontSize?: number;
}

export function ReaderProvider({ 
  children,
  initialText = '',
  initialSpeed = 300,
  initialFontSize = 64
}: ReaderProviderProps) {
  // Initialize state variables
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);
  const [currentWord, setCurrentWord] = useState('');
  const [text, setText] = useState(initialText);
  const [fontSize, setFontSizeState] = useState(initialFontSize);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize dark mode from localStorage
    return localStorage.getItem('darkMode') === 'true';
  });
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  // Service refs to maintain instances across re-renders
  const readerServiceRef = useRef<ReaderService | null>(null);
  const authServiceRef = useRef<AuthService | null>(null);

  // Initialize services and set up subscriptions
  useEffect(() => {
    readerServiceRef.current = new ReaderService();
    authServiceRef.current = new AuthService();

    const service = readerServiceRef.current;

    if (service) {
      // Load initial text if provided
      if (initialText) {
        service.loadContent(initialText);
      }
      
      // Set initial speed
      service.setSpeed(initialSpeed);

      // Subscribe to ReaderService events
      const playSubscription = () => setIsPlaying(true);
      const pauseSubscription = () => setIsPlaying(false);
      const speedChangeSubscription = (wpm: number) => setSpeed(wpm);
      const textChangeSubscription = (text: string) => setText(text);
      const progressChangeSubscription = (progress: { index: number }) => {
        setCurrentWordIndex(progress.index);
        setCurrentWord(service.getCurrentWord());
      };

      service.subscribe('play', playSubscription);
      service.subscribe('pause', pauseSubscription);
      service.subscribe('speedChange', speedChangeSubscription);
      service.subscribe('textChange', textChangeSubscription);
      service.subscribe('progressChange', progressChangeSubscription);

      // Cleanup subscriptions on unmount
      return () => {
        service.unsubscribe('play', playSubscription);
        service.unsubscribe('pause', pauseSubscription);
        service.unsubscribe('speedChange', speedChangeSubscription);
        service.unsubscribe('textChange', textChangeSubscription);
        service.unsubscribe('progressChange', progressChangeSubscription);
      };
    }
  }, []); // Empty dependency array - only run on mount/unmount

  // Context value object with state and functions
  const contextValue: ReaderContextType = {
    readerService: readerServiceRef.current,
    authService: authServiceRef.current,
    isPlaying,
    speed,
    currentWord,
    text,
    fontSize,
    isDarkMode,
    currentWordIndex,

    toggleDarkMode: () => {
      const newDarkMode = !isDarkMode;
      setIsDarkMode(newDarkMode);
      localStorage.setItem('darkMode', String(newDarkMode));
    },

    setFontSize: (size: number) => {
      setFontSizeState(size);
      // Optional: Add any font size related logic in ReaderService if needed
    },

    loadTextContent: (textContent: string) => {
      setText(textContent);
      readerServiceRef.current?.loadContent(textContent);
    },

    playReader: () => {
      readerServiceRef.current?.play();
    },

    pauseReader: () => {
      readerServiceRef.current?.pause();
    },

    setReaderSpeed: (wpm: number) => {
      setSpeed(wpm);
      readerServiceRef.current?.setSpeed(wpm);
    },
  };

  return (
    <ReaderContext.Provider value={contextValue}>
      {children}
    </ReaderContext.Provider>
  );
} 