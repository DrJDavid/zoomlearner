// Initialize PDF.js
import 'pdfjs-dist/legacy/build/pdf';
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf';
import { RSVPReader } from './lib/RSVPReader';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';

// Initialize PDF.js worker
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.js',
  import.meta.url
).href;

import './style.css';

// Auth State Management
let currentUser: User | null = null;

// Auth UI Elements
const authModal = document.getElementById('authModal') as HTMLDivElement;
const authButton = document.getElementById('authButton') as HTMLButtonElement;
const authButtonText = document.getElementById('authButtonText') as HTMLSpanElement;
const closeAuthModal = document.getElementById('closeAuthModal') as HTMLButtonElement;
const signInButton = document.getElementById('signInButton') as HTMLButtonElement;
const signUpButton = document.getElementById('signUpButton') as HTMLButtonElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const authMessage = document.getElementById('authMessage') as HTMLDivElement;

// DOM Elements
const textInput = document.getElementById('textInput') as HTMLTextAreaElement;
const startButton = document.getElementById('startButton') as HTMLButtonElement;
const pauseButton = document.getElementById('pauseButton') as HTMLButtonElement;
const resumeButton = document.getElementById('resumeButton') as HTMLButtonElement;
const wordDisplay = document.getElementById('wordDisplay') as HTMLDivElement;
const wpmInput = document.getElementById('wpm') as HTMLInputElement;
const fontSizeInput = document.getElementById('fontSize') as HTMLInputElement;
const fontSizeValue = document.querySelector('.font-size-value') as HTMLSpanElement;
const openFileButton = document.getElementById('openFileButton') as HTMLButtonElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const loadUrlButton = document.getElementById('loadUrlButton') as HTMLButtonElement;
const urlInput = document.querySelector('.url-input') as HTMLInputElement;
const darkModeButton = document.getElementById('darkModeButton') as HTMLButtonElement;
const fullscreenButton = document.getElementById('fullscreenButton') as HTMLButtonElement;
const saveBookmarkButton = document.getElementById('saveBookmarkButton') as HTMLButtonElement;

// State variables
let isDarkMode = localStorage.getItem('darkMode') === 'true';
let isFullscreen = false;

// Initialize dark mode
if (isDarkMode) {
    document.body.classList.add('dark-mode');
}

// Initialize the reader
const reader = new RSVPReader();

// Set up UI bindings
reader.onTextChange = (text) => {
    textInput.value = text;
};

reader.onProgressChange = (index, total) => {
    const wordContainer = wordDisplay.querySelector('.word-container');
    if (wordContainer) {
        wordContainer.textContent = reader.getCurrentWord();
    }
};

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Don't handle if we're in an input field or textarea
    if ((e.target as HTMLElement).tagName === 'INPUT' || 
        (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
    }

    // Handle shortcuts
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            if (startButton.style.display !== 'none') {
                startButton.click();
            } else if (pauseButton.style.display !== 'none') {
                pauseButton.click();
            } else if (resumeButton.style.display !== 'none') {
                resumeButton.click();
            }
            break;

        case 'ArrowUp':
            e.preventDefault();
            const newSpeedUp = Math.min(1000, parseInt(wpmInput.value) + 25);
            wpmInput.value = newSpeedUp.toString();
            reader.setSpeed(newSpeedUp);
            break;

        case 'ArrowDown':
            e.preventDefault();
            const newSpeedDown = Math.max(60, parseInt(wpmInput.value) - 25);
            wpmInput.value = newSpeedDown.toString();
            reader.setSpeed(newSpeedDown);
            break;

        case 'ArrowLeft':
            e.preventDefault();
            const prevIndex = reader.getCurrentIndex();
            if (prevIndex > 0) {
                if (pauseButton.style.display !== 'none') {
                    pauseButton.click();
                }
                reader.setCurrentIndex(prevIndex - 1);
                const wordContainer = wordDisplay.querySelector('.word-container');
                if (wordContainer) {
                    wordContainer.textContent = reader.getCurrentWord();
                }
            }
            break;

        case 'ArrowRight':
            e.preventDefault();
            const nextIndex = reader.getCurrentIndex();
            const words = reader.getWords();
            if (nextIndex < words.length - 1) {
                if (pauseButton.style.display !== 'none') {
                    pauseButton.click();
                }
                reader.setCurrentIndex(nextIndex + 1);
                const wordContainer = wordDisplay.querySelector('.word-container');
                if (wordContainer) {
                    wordContainer.textContent = reader.getCurrentWord();
                }
            }
            break;

        case 'KeyF':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                fullscreenButton.click();
            }
            break;

        case 'KeyS':
            if ((e.ctrlKey || e.metaKey) && currentUser) {
                e.preventDefault();
                saveBookmarkButton.click();
            }
            break;
    }
});

// Dark mode toggle
darkModeButton.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode.toString());
    if (currentUser) saveUserPreferences();
});

// Listen for fullscreen changes from browser
document.addEventListener('fullscreenchange', () => {
    isFullscreen = !!document.fullscreenElement;
    if (!isFullscreen) {
        // Restore normal state when exiting fullscreen
        wordDisplay.classList.remove('fullscreen');
    }
});

// Fullscreen toggle
fullscreenButton.addEventListener('click', async () => {
    try {
        if (!isFullscreen) {
            wordDisplay.classList.add('fullscreen');
            await wordDisplay.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch (error) {
        console.error('Fullscreen error:', error);
    }
});

// File input handling
openFileButton.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
        try {
            await reader.loadFile(file);
        } catch (error) {
            console.error('Error loading file:', error);
            alert('Error loading file. Please try again.');
        }
    }
});

// URL loading
loadUrlButton.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;

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
        reader.loadContent(cleanText);
    } catch (error) {
        console.error('Error loading URL:', error);
        alert('Failed to load URL. Please check the URL and try again.');
    }
});

// Reader controls
startButton.addEventListener('click', () => {
    if (!textInput.value.trim()) {
        alert('Please load or enter some text first');
        return;
    }
    
    if (!reader.getWords().length) {
        reader.loadContent(textInput.value);
    }
    
    reader.start();
    startButton.style.display = 'none';
    pauseButton.style.display = 'inline-block';
    resumeButton.style.display = 'none';
});

pauseButton.addEventListener('click', () => {
    reader.pause();
    startButton.style.display = 'none';
    pauseButton.style.display = 'none';
    resumeButton.style.display = 'inline-block';
});

resumeButton.addEventListener('click', () => {
    reader.start();
    startButton.style.display = 'none';
    pauseButton.style.display = 'inline-block';
    resumeButton.style.display = 'none';
});

wpmInput.addEventListener('input', () => {
    const wpm = parseInt(wpmInput.value);
    reader.setSpeed(wpm);
});

// Font size handling
fontSizeInput.addEventListener('input', () => {
    const size = fontSizeInput.value;
    const wordContainer = wordDisplay.querySelector('.word-container') as HTMLDivElement;
    if (wordContainer) {
        wordContainer.style.fontSize = `${size}px`;
        fontSizeValue.textContent = `${size}px`;
    }
});

// Save bookmark
saveBookmarkButton.addEventListener('click', async () => {
    if (!currentUser) {
        alert('Please sign in to save bookmarks');
        return;
    }

    if (!textInput.value.trim()) {
        alert('Please load or enter some text first');
        return;
    }

    try {
        // Calculate content hash to prevent duplicates
        const contentHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(textInput.value))
            .then(hash => Array.from(new Uint8Array(hash))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(''));

        // First insert the document
        const { data: doc, error: docError } = await supabase
            .from('documents')
            .insert([
                {
                    user_id: currentUser.id,
                    title: `Reading ${new Date().toLocaleString()}`,
                    description: `Saved at word ${reader.getCurrentIndex() + 1} of ${reader.getWords().length}`,
                    source_type: 'text',
                    content_hash: contentHash,
                    total_chunks: 1,
                    estimated_reading_time: Math.ceil(reader.getWords().length / reader.getSpeed())
                }
            ])
            .select()
            .single();

        if (docError) {
            console.error('Document insert error:', docError);
            throw docError;
        }

        if (!doc) {
            throw new Error('No document data returned after insert');
        }

        // Then insert the reading session with font size
        const { error: sessionError } = await supabase
            .from('reading_sessions')
            .insert([
                {
                    user_id: currentUser.id,
                    document_id: doc.id,
                    current_word_index: reader.getCurrentIndex(),
                    text_content: textInput.value,
                    wpm: reader.getSpeed(),
                    font_size: parseInt(fontSizeInput.value)
                }
            ]);

        if (sessionError) {
            console.error('Session insert error:', sessionError);
            throw sessionError;
        }
        
        alert('Reading progress saved!');
        await loadUserDocuments(); // Refresh the bookmarks list
    } catch (error: any) {
        console.error('Error saving bookmark:', error);
        alert(`Failed to save bookmark: ${error.message || 'Unknown error'}`);
    }
});

// Auth Event Listeners
authButton.addEventListener('click', () => {
    if (currentUser) {
        handleSignOut();
    } else {
        authModal.classList.add('active');
    }
});

closeAuthModal.addEventListener('click', () => {
    authModal.classList.remove('active');
    clearAuthForm();
});

signInButton.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    try {
        const { data: { user }, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        currentUser = user;
        updateAuthState();
        showAuthMessage('Successfully signed in!', false);
        setTimeout(() => {
            authModal.classList.remove('active');
            clearAuthForm();
        }, 1500);
        
    } catch (error: any) {
        showAuthMessage(error.message, true);
    }
});

signUpButton.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    try {
        const { data: { user }, error } = await supabase.auth.signUp({
            email,
            password
        });
        
        if (error) throw error;

        if (user) {
            // Create initial user preferences
            const { error: prefError } = await supabase
                .from('user_preferences')
                .insert([{
                    user_id: user.id,
                    wpm: 300,
                    font_size: 64,
                    dark_mode: false,
                    quizzes_enabled: true,
                    autopause_enabled: true
                }]);

            if (prefError) console.error('Error creating preferences:', prefError);
        }
        
        showAuthMessage('Check your email to confirm your account!', false);
        setTimeout(() => {
            authModal.classList.remove('active');
            clearAuthForm();
        }, 3000);
        
    } catch (error: any) {
        showAuthMessage(error.message, true);
    }
});

// Auth Helper Functions
function updateAuthState() {
    if (currentUser) {
        authButtonText.textContent = 'Sign Out';
        // Enable user-specific features
        loadUserDocuments();
        loadUserPreferences(); // Load preferences when signing in
    } else {
        authButtonText.textContent = 'Sign In';
        // Reset to local-only mode
        loadLocalDocuments();
    }
}

async function handleSignOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        updateAuthState();
        showAuthMessage('Successfully signed out!', false);
        
    } catch (error: any) {
        showAuthMessage(error.message, true);
    }
}

function showAuthMessage(message: string, isError: boolean) {
    authMessage.textContent = message;
    authMessage.className = 'auth-message ' + (isError ? 'error' : 'success');
}

function clearAuthForm() {
    emailInput.value = '';
    passwordInput.value = '';
    authMessage.textContent = '';
    authMessage.className = 'auth-message';
}

// Check for existing session
supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
        currentUser = session.user;
        updateAuthState();
    }
});

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session?.user ?? null;
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
    }
    updateAuthState();
});

// Document loading functions
async function loadUserDocuments() {
    if (!currentUser) return;
    
    try {
        const { data: documents, error } = await supabase
            .from('documents')
            .select(`
                *,
                reading_sessions (
                    current_word_index,
                    text_content,
                    wpm,
                    font_size,
                    created_at
                )
            `)
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        updateDocumentsList(documents || []);
        
    } catch (error: any) {
        console.error('Error loading documents:', error);
    }
}

function loadLocalDocuments() {
    // Keep existing localStorage functionality for non-authenticated users
    const bookmarks = getAllBookmarks();
    updateDocumentsList(bookmarks);
}

function updateDocumentsList(documents: any[]) {
    const bookmarksList = document.getElementById('bookmarksList');
    if (!bookmarksList) return;
    
    bookmarksList.innerHTML = '';
    documents.forEach(doc => {
        const item = createDocumentElement(doc);
        bookmarksList.appendChild(item);
    });
}

function createDocumentElement(doc: any) {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    item.setAttribute('data-id', doc.id);
    
    const session = doc.reading_sessions?.[0];
    const progress = session?.current_word_index || 0;
    const words = session?.text_content?.split(/\s+/).length || 0;
    const progressPercent = words ? Math.round((progress / words) * 100) : 0;
    
    item.innerHTML = `
        <div class="bookmark-info">
            <h4 class="bookmark-title">${doc.title}</h4>
            <div class="bookmark-meta">
                Progress: ${progressPercent}% • WPM: ${session?.wpm || 300}
            </div>
        </div>
        <div class="bookmark-actions">
            <button class="bookmark-delete" title="Delete document">×</button>
        </div>
    `;
    
    // Load document on click
    item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.bookmark-delete')) {
            loadSavedDocument(doc, session);
        }
    });
    
    // Delete document
    const deleteBtn = item.querySelector('.bookmark-delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await deleteDocument(doc.id);
        });
    }
    
    return item;
}

async function loadSavedDocument(doc: any, session: any) {
    if (!session?.text_content) {
        alert('No content found for this document');
        return;
    }

    // Load the content and settings
    reader.loadContent(session.text_content);
    reader.setSpeed(session.wpm || 300);
    wpmInput.value = (session.wpm || 300).toString();
    
    // Apply saved font size if available, otherwise keep current
    if (session.font_size) {
        fontSizeInput.value = session.font_size.toString();
        // Trigger the font size update
        const event = new Event('input');
        fontSizeInput.dispatchEvent(event);
    }

    // Update UI
    const items = document.querySelectorAll('.bookmark-item');
    items.forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-id="${doc.id}"]`)?.classList.add('active');
}

async function deleteDocument(docId: string) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
        const { error } = await supabase
            .from('documents')
            .delete()
            .eq('id', docId);
            
        if (error) throw error;
        
        await loadUserDocuments(); // Refresh the list
    } catch (error: any) {
        console.error('Error deleting document:', error);
        alert('Failed to delete document');
    }
}

function getAllBookmarks() {
    try {
        return JSON.parse(localStorage.getItem('rsvp-bookmarks') || '[]');
    } catch {
        return [];
    }
}

// Save progress periodically
setInterval(() => {
    if (currentUser && reader.isReading()) {
        const currentDoc = document.querySelector('.bookmark-item.active')?.getAttribute('data-id');
        if (currentDoc) {
            supabase.from('reading_sessions').insert([{
                user_id: currentUser.id,
                document_id: currentDoc,
                current_word_index: reader.getCurrentIndex(),
                wpm: reader.getSpeed(),
                font_size: parseInt(fontSizeInput.value)
            }]);
        }
    }
}, 30000); // Save every 30 seconds 

// Load and save user preferences
async function loadUserPreferences() {
    if (!currentUser) return;

    try {
        const { data: prefs, error } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

        if (error) throw error;

        if (prefs) {
            // Apply preferences
            reader.setSpeed(prefs.wpm);
            wpmInput.value = prefs.wpm.toString();
            fontSizeInput.value = prefs.font_size.toString();
            if (prefs.dark_mode !== isDarkMode) {
                darkModeButton.click(); // Toggle if different
            }
            // Trigger font size update
            const event = new Event('input');
            fontSizeInput.dispatchEvent(event);
        }
    } catch (error) {
        console.error('Error loading preferences:', error);
    }
}

async function saveUserPreferences() {
    if (!currentUser) return;

    try {
        const { error } = await supabase
            .from('user_preferences')
            .upsert({
                user_id: currentUser.id,
                wpm: reader.getSpeed(),
                font_size: parseInt(fontSizeInput.value),
                dark_mode: isDarkMode,
                quizzes_enabled: true,
                autopause_enabled: true
            }, {
                onConflict: 'user_id'
            });

        if (error) throw error;
    } catch (error) {
        console.error('Error saving preferences:', error);
    }
}

// Add preference change listeners
wpmInput.addEventListener('change', () => {
    if (currentUser) saveUserPreferences();
});

fontSizeInput.addEventListener('change', () => {
    if (currentUser) saveUserPreferences();
}); 