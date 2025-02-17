class RSVPReader {
    constructor() {
        this.words = [];
        this.wordIndex = 0;
        this.isPlaying = false;
        this.lastFrameTime = 0;
        
        // DOM elements
        this.textInput = document.getElementById('textInput');
        this.wordDisplay = document.getElementById('wordDisplay').querySelector('.word-container');
        this.wpmInput = document.getElementById('wpm');
        this.startButton = document.getElementById('startButton');
        this.pauseButton = document.getElementById('pauseButton');
        this.resumeButton = document.getElementById('resumeButton');
        
        // Add progress indicator
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'progress-bar';
        this.wordDisplay.parentElement.appendChild(this.progressBar);
        
        // Add file input elements
        this.fileInput = document.getElementById('fileInput');
        this.openFileButton = document.getElementById('openFileButton');
        this.fileName = document.getElementById('fileName');
        
        // Add new buttons
        this.fullscreenButton = document.getElementById('fullscreenButton');
        this.darkModeButton = document.getElementById('darkModeButton');
        
        // Initialize dark mode from localStorage
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
        }
        
        // Get the existing URL input and button
        this.urlInput = document.querySelector('.url-input');
        this.urlButton = document.getElementById('loadUrlButton');
        
        // Add to existing DOM elements
        this.fontSizeInput = document.getElementById('fontSize');
        this.fontSizeValue = document.querySelector('.font-size-value');
        
        // Add bookmark elements
        this.saveBookmarkButton = document.getElementById('saveBookmarkButton');
        this.bookmarksList = document.getElementById('bookmarksList');
        
        // Bind all events
        this.bindEvents();
        this.bindKeyboardControls();
        this.bindFileEvents();
        this.bindFullscreenEvents();
        this.bindDarkModeEvents();
        this.bindUrlEvents();
        this.bindFontSizeControls();
        this.bindBookmarkEvents();
        
        // Load existing bookmarks
        this.loadBookmarksList();
    }
    
    bindEvents() {
        this.startButton.addEventListener('click', () => this.start());
        this.pauseButton.addEventListener('click', () => this.pause());
        this.resumeButton.addEventListener('click', () => this.resume());
    }
    
    bindKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            // Don't handle if typing in input or URL field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.isPlaying ? this.pause() : this.resume();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.wpmInput.value = Math.min(1000, parseInt(this.wpmInput.value) + 50);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.wpmInput.value = Math.max(60, parseInt(this.wpmInput.value) - 50);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (this.wordIndex > 0) {
                        this.wordIndex = Math.max(0, this.wordIndex - 2);
                        this.wordDisplay.textContent = this.words[this.wordIndex];
                        // Update progress bar
                        const progress = (this.wordIndex / this.words.length) * 100;
                        this.progressBar.style.width = `${progress}%`;
                    }
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (this.wordIndex < this.words.length) {
                        this.wordIndex = Math.min(this.words.length - 1, this.wordIndex + 1);
                        this.wordDisplay.textContent = this.words[this.wordIndex];
                        // Update progress bar
                        const progress = (this.wordIndex / this.words.length) * 100;
                        this.progressBar.style.width = `${progress}%`;
                    }
                    break;
                case 'KeyF':
                    // Check for both Ctrl/Cmd + F
                    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                        e.preventDefault();
                        this.toggleFullscreen();
                    }
                    break;
                case 'KeyS':
                    // Add Ctrl/Cmd + S shortcut for saving
                    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                        e.preventDefault();
                        this.saveBookmark();
                    }
                    break;
            }
        });
    }
    
    bindFileEvents() {
        this.openFileButton.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        this.fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await this.readFile(file);
                this.textInput.value = text;
                this.fileName.textContent = file.name;
                
                // Auto-start reading if requested
                if (confirm('Start reading the file now?')) {
                    this.start();
                }
            } catch (error) {
                alert('Error reading file: ' + error.message);
            }
        });
        
        // Add drag and drop support
        this.textInput.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.textInput.classList.add('dragover');
        });
        
        this.textInput.addEventListener('dragleave', () => {
            this.textInput.classList.remove('dragover');
        });
        
        this.textInput.addEventListener('drop', async (e) => {
            e.preventDefault();
            this.textInput.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (!file) return;
            
            try {
                const text = await this.readFile(file);
                this.textInput.value = text;
                this.fileName.textContent = file.name;
            } catch (error) {
                alert('Error reading file: ' + error.message);
            }
        });
    }
    
    bindUrlEvents() {
        this.urlButton.addEventListener('click', async () => {
            const url = this.urlInput.value.trim();
            if (!url) return;
            
            try {
                const text = await this.fetchUrlContent(url);
                this.textInput.value = text;
                this.fileName.textContent = new URL(url).hostname;
                
                if (confirm('Start reading the content now?')) {
                    this.start();
                }
            } catch (error) {
                alert('Error fetching URL: ' + error.message);
            }
        });
    }
    
    async fetchUrlContent(url) {
        try {
            const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            
            // Create a temporary element to parse the HTML
            const doc = new DOMParser().parseFromString(data.contents, 'text/html');
            
            // Remove unwanted elements
            ['script', 'style', 'header', 'footer', 'nav', 'aside'].forEach(tag => {
                doc.querySelectorAll(tag).forEach(el => el.remove());
            });
            
            // Try to find main content
            const mainContent = 
                doc.querySelector('article') || 
                doc.querySelector('main') || 
                doc.querySelector('.content') ||
                doc.querySelector('.post') ||
                doc.body;
            
            return mainContent.textContent.trim();
        } catch (error) {
            throw new Error('Failed to fetch URL content');
        }
    }
    
    async readFile(file) {
        // Check file size
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (file.size > MAX_FILE_SIZE) {
            throw new Error('File is too large (max 10MB)');
        }
        
        // Expanded file type support
        const allowedTypes = {
            // Text formats
            'text/plain': text => text,
            'text/markdown': text => this.parseMarkdown(text),
            'text/html': text => this.parseHTML(text),
            
            // Document formats
            'application/msword': null, // .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': null, // .docx
            'application/vnd.oasis.opendocument.text': null, // .odt
            'application/rtf': null, // .rtf
            
            // Code formats
            'application/json': text => JSON.parse(text).toString(),
            'text/javascript': text => text,
            'text/css': text => text,
            
            // Additional formats
            'application/pdf': null, // Will handle with PDF.js
            'text/csv': text => this.parseCSV(text),
            'application/epub+zip': null // Will handle with ePub.js
        };
        
        // Check file extension if MIME type is not recognized
        const extension = file.name.split('.').pop().toLowerCase();
        const extensionMap = {
            'md': 'text/markdown',
            'markdown': 'text/markdown',
            'txt': 'text/plain',
            'html': 'text/html',
            'htm': 'text/html',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'odt': 'application/vnd.oasis.opendocument.text',
            'rtf': 'application/rtf',
            'json': 'application/json',
            'js': 'text/javascript',
            'css': 'text/css',
            'pdf': 'application/pdf',
            'csv': 'text/csv',
            'epub': 'application/epub+zip'
        };
        
        const mimeType = file.type || extensionMap[extension];
        if (!allowedTypes.hasOwnProperty(mimeType)) {
            throw new Error('Unsupported file type');
        }
        
        // Handle binary formats
        if (mimeType.startsWith('application/')) {
            switch(mimeType) {
                case 'application/pdf':
                    return await this.parsePDF(file);
                case 'application/msword':
                case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                case 'application/vnd.oasis.opendocument.text':
                    return await this.parseDocument(file, mimeType);
                case 'application/epub+zip':
                    return await this.parseEPUB(file);
                default:
                    throw new Error('Unsupported binary format');
            }
        }
        
        // Handle text formats
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    let text = e.target.result;
                    const parser = allowedTypes[mimeType];
                    if (parser) {
                        text = await parser(text);
                    }
                    resolve(text);
                } catch (error) {
                    reject(new Error(`Failed to parse file: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    
    async parseMarkdown(text) {
        // Enhanced markdown parsing
        return text
            // Headers
            .replace(/#{1,6}\s+([^\n]+)/g, '$1\n')
            // Lists (both unordered and ordered)
            .replace(/(?:^|\n)[-*+]\s+([^\n]+)/g, '\n$1')
            .replace(/(?:^|\n)\d+\.\s+([^\n]+)/g, '\n$1')
            // Links (including reference-style)
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
            .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
            // Images
            .replace(/!\[[^\]]*\]\([^\)]+\)/g, '')
            // Emphasis
            .replace(/(?:\*\*|__)(.*?)(?:\*\*|__)/g, '$1')
            .replace(/(?:\*|_)(.*?)(?:\*|_)/g, '$1')
            // Code blocks and inline code
            .replace(/```[\s\S]+?```/g, '')
            .replace(/`([^`]+)`/g, '$1')
            // Blockquotes
            .replace(/^\s*>\s+([^\n]+)/gm, '$1')
            // Tables
            .replace(/\|[^\n]+\|/g, line => 
                line.split('|')
                    .filter(cell => cell.trim())
                    .map(cell => cell.trim())
                    .join(' ')
            )
            // Horizontal rules
            .replace(/(?:^|\n)[-*_]{3,}\s*(?:\n|$)/g, '\n')
            // Multiple newlines
            .replace(/\n\s*\n/g, '\n')
            .trim();
    }
    
    async parseHTML(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        // Remove unwanted elements
        ['script', 'style', 'header', 'footer', 'nav', 'aside', 'iframe'].forEach(tag => {
            doc.querySelectorAll(tag).forEach(el => el.remove());
        });
        
        // Try to find main content
        const mainContent = 
            doc.querySelector('article') || 
            doc.querySelector('main') || 
            doc.querySelector('.content') ||
            doc.querySelector('.post') ||
            doc.body;
        
        // Clean up the text
        return mainContent.textContent
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    async parseCSV(text) {
        // Simple CSV parsing
        return text
            .split('\n')
            .map(line => line.split(',').map(cell => cell.trim()).join(' '))
            .join('\n');
    }
    
    async parsePDF(file) {
        // We'll need to include PDF.js library
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }
        
        return text.trim();
    }
    
    async parseDocument(file, mimeType) {
        // Convert file to ArrayBuffer for Mammoth
        const arrayBuffer = await file.arrayBuffer();
        
        try {
            // Use Mammoth to convert the document
            const result = await mammoth.extractRawText({ arrayBuffer });
            
            if (result.messages.length > 0) {
                console.log("Parsing warnings:", result.messages);
            }
            
            // Clean up the extracted text
            return result.value
                .replace(/\r\n/g, '\n') // Normalize line endings
                .replace(/\n\s*\n/g, '\n') // Remove extra blank lines
                .replace(/\s+/g, ' ') // Normalize spaces
                .trim();
                
        } catch (error) {
            throw new Error(`Failed to parse document: ${error.message}`);
        }
    }
    
    async parseEPUB(file) {
        // We'll need to include ePub.js library
        const book = ePub(file);
        await book.ready;
        
        let text = '';
        const spine = book.spine;
        
        for (const item of spine.items) {
            const doc = await item.load();
            text += doc.textContent + '\n';
        }
        
        return text.trim();
    }
    
    start() {
        const text = this.textInput.value.trim();
        if (!text) {
            alert('Please enter some text to read');
            return;
        }
        
        this.words = text.split(/\s+/);
        this.wordIndex = 0;
        this.isPlaying = true;
        this.lastFrameTime = performance.now();
        this.animate();
        
        // Reset file name when starting new text
        if (!this.fileName.textContent) {
            this.fileName.textContent = 'Custom text';
        }
    }
    
    pause() {
        this.isPlaying = false;
    }
    
    resume() {
        if (this.wordIndex < this.words.length) {
            this.isPlaying = true;
            this.lastFrameTime = performance.now();
            this.animate();
        }
    }
    
    animate(currentTime = performance.now()) {
        if (!this.isPlaying) return;
        
        const wpm = parseInt(this.wpmInput.value) || 300;
        const msPerWord = 60000 / wpm;
        
        if (currentTime - this.lastFrameTime >= msPerWord) {
            if (this.wordIndex >= this.words.length) {
                this.isPlaying = false;
                this.wordDisplay.textContent = 'Finished!';
                return;
            }
            
            this.wordDisplay.textContent = this.words[this.wordIndex];
            this.wordIndex++;
            this.lastFrameTime = currentTime;
            
            // Update progress bar
            const progress = (this.wordIndex / this.words.length) * 100;
            this.progressBar.style.width = `${progress}%`;
        }
        
        requestAnimationFrame(time => this.animate(time));
    }
    
    bindFullscreenEvents() {
        this.fullscreenButton.addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        document.addEventListener('fullscreenchange', () => {
            const display = this.wordDisplay.parentElement;
            if (!document.fullscreenElement) {
                display.classList.remove('fullscreen');
            }
        });
    }
    
    bindDarkModeEvents() {
        this.darkModeButton.addEventListener('click', () => {
            this.isDarkMode = !this.isDarkMode;
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', this.isDarkMode);
            
            // Update button text
            this.darkModeButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 16 16" class="icon">
                    <path d="${this.isDarkMode ? 
                        'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8z' : 
                        'M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z'}" 
                    fill="currentColor"/>
                </svg>
                ${this.isDarkMode ? 'Light Mode' : 'Dark Mode'}
            `;
        });
    }
    
    toggleFullscreen() {
        const display = this.wordDisplay.parentElement;
        if (!document.fullscreenElement) {
            display.requestFullscreen().catch(err => {
                alert(`Error attempting to enable fullscreen: ${err.message}`);
            });
            display.classList.add('fullscreen');
        } else {
            document.exitFullscreen();
            display.classList.remove('fullscreen');
        }
    }
    
    bindFontSizeControls() {
        this.fontSizeInput.addEventListener('input', (e) => {
            const size = e.target.value;
            this.wordDisplay.style.fontSize = `${size}px`;
            this.fontSizeValue.textContent = `${size}px`;
        });
    }
    
    bindBookmarkEvents() {
        this.saveBookmarkButton.addEventListener('click', () => {
            this.saveBookmark();
        });
    }
    
    saveBookmark() {
        const bookmark = {
            id: Date.now().toString(), // Unique ID
            text: this.textInput.value,
            wordIndex: this.wordIndex,
            wpm: parseInt(this.wpmInput.value),
            fontSize: parseInt(this.fontSizeInput.value),
            isDarkMode: this.isDarkMode,
            timestamp: new Date().toISOString()
        };
        
        const bookmarks = this.getAllBookmarks();
        bookmarks.push(bookmark);
        localStorage.setItem('rsvp-bookmarks', JSON.stringify(bookmarks));
        
        this.loadBookmarksList();
        alert('Reading position saved!');
    }
    
    loadBookmarksList() {
        const bookmarks = this.getAllBookmarks();
        this.bookmarksList.innerHTML = '';
        
        bookmarks.forEach(bookmark => {
            const item = this.createBookmarkElement(bookmark);
            this.bookmarksList.appendChild(item);
        });
    }
    
    createBookmarkElement(bookmark) {
        const item = document.createElement('div');
        item.className = 'bookmark-item';
        
        // Get first few words of text for title
        const title = bookmark.text.split(/\s+/).slice(0, 5).join(' ') + '...';
        const progress = Math.round((bookmark.wordIndex / bookmark.text.split(/\s+/).length) * 100);
        
        item.innerHTML = `
            <div class="bookmark-info">
                <h4 class="bookmark-title">${title}</h4>
                <div class="bookmark-meta">
                    Progress: ${progress}% • WPM: ${bookmark.wpm}
                </div>
            </div>
            <div class="bookmark-actions">
                <button class="bookmark-delete" title="Delete bookmark">
                    <svg width="12" height="12" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Load bookmark on click
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.bookmark-delete')) {
                this.loadBookmark(bookmark.id);
            }
        });
        
        // Delete bookmark
        item.querySelector('.bookmark-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteBookmark(bookmark.id);
        });
        
        return item;
    }
    
    getAllBookmarks() {
        try {
            return JSON.parse(localStorage.getItem('rsvp-bookmarks')) || [];
        } catch {
            return [];
        }
    }
    
    deleteBookmark(id) {
        if (confirm('Delete this bookmark?')) {
            const bookmarks = this.getAllBookmarks();
            const filtered = bookmarks.filter(b => b.id !== id);
            localStorage.setItem('rsvp-bookmarks', JSON.stringify(filtered));
            this.loadBookmarksList();
        }
    }
    
    loadBookmark(id) {
        const bookmarks = this.getAllBookmarks();
        const bookmark = bookmarks.find(b => b.id === id);
        
        if (!bookmark) {
            alert('Bookmark not found');
            return;
        }
        
        // Restore settings
        this.textInput.value = bookmark.text;
        this.wpmInput.value = bookmark.wpm;
        this.fontSizeInput.value = bookmark.fontSize;
        this.wordDisplay.style.fontSize = `${bookmark.fontSize}px`;
        this.fontSizeValue.textContent = `${bookmark.fontSize}px`;
        
        // Restore dark mode if needed
        if (bookmark.isDarkMode !== this.isDarkMode) {
            this.darkModeButton.click();
        }
        
        // Start reading from saved position
        this.words = bookmark.text.split(/\s+/);
        this.wordIndex = bookmark.wordIndex;
        this.isPlaying = true;
        this.lastFrameTime = performance.now();
        this.animate();
    }
}

// Initialize the reader when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new RSVPReader();
}); 