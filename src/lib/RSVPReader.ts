// Import PDF.js
import 'pdfjs-dist/legacy/build/pdf';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf';
import JSZip from 'jszip';

// Initialize PDF.js worker
GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

export class RSVPReader {
  private text: string = '';
  private words: string[] = [];
  private isPlaying: boolean = false;
  private speed: number = 300; // words per minute
  private intervalId?: number;
  private currentIndex: number = 0;

  // Callbacks
  public onTextChange?: (text: string) => void;
  public onProgressChange?: (index: number, total: number) => void;
  public onSpeedChange?: (wpm: number) => void;

  constructor() {
    // Remove keyboard binding from constructor
  }

  public async loadFile(file: File) {
    try {
      switch (file.type) {
        case 'application/pdf':
      await this.loadPDF(file);
          break;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          await this.loadWord(file);
          break;
        case 'application/epub+zip':
          await this.loadEPUB(file);
          break;
        case 'application/vnd.oasis.opendocument.text':
          await this.loadODT(file);
          break;
        case 'application/rtf':
        case 'text/rtf':
          await this.loadRTF(file);
          break;
        default:
          // Handle text files and other formats
      const text = await file.text();
      this.loadContent(text);
      }
    } catch (error) {
      console.error('Error loading file:', error);
      throw error;
    }
  }

  private async loadPDF(file: File) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = getDocument({
        data: arrayBuffer,
        useSystemFonts: true
      });
      
      const pdf = await loadingTask.promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n\n';
        } catch (pageError) {
          console.warn(`Error extracting text from page ${i}:`, pageError);
          continue;
        }
      }

      if (!fullText.trim()) {
        throw new Error('No text content could be extracted from the PDF');
      }

      this.loadContent(fullText);
    } catch (error) {
      console.error('Error loading PDF:', error);
      throw error;
    }
  }

  private async loadWord(file: File) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      
      if (result.value) {
        const cleanText = result.value
          .replace(/[\r\n]+/g, '\n')
          .replace(/\s+/g, ' ')
          .trim();
        
        this.loadContent(cleanText);
      } else {
        throw new Error('No text content found in Word document');
      }

      if (result.messages.length > 0) {
        console.warn('Word document conversion warnings:', result.messages);
      }
    } catch (error) {
      console.error('Error loading Word document:', error);
      throw error;
    }
  }

  private async loadEPUB(file: File) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = new JSZip();
      const epub = await zip.loadAsync(arrayBuffer);
      
      const containerXml = await epub.file('META-INF/container.xml')?.async('text');
      if (!containerXml) {
        throw new Error('Invalid EPUB: container.xml not found');
      }
      
      const parser = new DOMParser();
      const containerDoc = parser.parseFromString(containerXml, 'text/xml');
      const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
      if (!opfPath) {
        throw new Error('Invalid EPUB: content.opf path not found');
      }
      
      const opfContent = await epub.file(opfPath)?.async('text');
      if (!opfContent) {
        throw new Error('Invalid EPUB: content.opf not found');
      }
      
      const opfDoc = parser.parseFromString(opfContent, 'text/xml');
      
      const manifest = Array.from(opfDoc.querySelectorAll('manifest item')).reduce((acc, item) => {
        acc[item.getAttribute('id') || ''] = item.getAttribute('href') || '';
        return acc;
      }, {} as { [key: string]: string });
      
      const spine = Array.from(opfDoc.querySelectorAll('spine itemref')).map(item => 
        manifest[item.getAttribute('idref') || '']
      ).filter(Boolean);
      
      const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
      
      let fullText = '';
      for (const href of spine) {
        try {
          const filePath = opfDir + href;
          const content = await epub.file(filePath)?.async('text');
          if (content) {
            const doc = parser.parseFromString(content, 'text/html');
            const text = this.cleanEPUBContent(doc.body);
            if (text.trim()) {
              fullText += text + '\n\n';
            }
          }
        } catch (error) {
          console.warn('Error processing chapter:', error);
          continue;
        }
      }
      
      const cleanedText = fullText.trim();
      if (cleanedText) {
        this.loadContent(cleanedText);
      } else {
        throw new Error('No text content found in EPUB');
      }
    } catch (error) {
      console.error('Error loading EPUB:', error);
      throw error;
    }
  }

  private cleanEPUBContent(element: HTMLElement): string {
    const unwanted = element.querySelectorAll('script, style, nav, [role="doc-noteref"]');
    unwanted.forEach(el => el.remove());
    
    const specialElements = element.querySelectorAll('h1, h2, h3, h4, h5, h6, p, br, div');
    specialElements.forEach(el => {
      if (el.tagName === 'BR' || el.tagName === 'P' || el.tagName.startsWith('H')) {
        el.insertAdjacentText('afterend', '\n');
      }
    });
    
    let text = element.textContent || '';
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  private async loadODT(file: File) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      try {
        const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
        if (result.value) {
          const cleanText = result.value
            .replace(/[\r\n]+/g, '\n')
            .replace(/\s+/g, ' ')
            .trim();
          
          this.loadContent(cleanText);
          return;
        }
      } catch {
        const text = await this.extractTextFromBinary(arrayBuffer);
        if (text) {
          this.loadContent(text);
          return;
        }
      }
      
      throw new Error('Could not extract text from ODT file');
    } catch (error) {
      console.error('Error loading ODT:', error);
      throw error;
    }
  }

  private async loadRTF(file: File) {
    try {
      const text = await file.text();
      
      let cleanText = text
        .replace(/[\\](?:rtf[0-9]+|[a-z]+)[\\]?/g, '')
        .replace(/[\\][\\'\{\}]/g, '')
        .replace(/\{[^\}]*\}/g, '')
        .replace(/[\\]par[\\]?/g, '\n')
        .replace(/[\\]tab[\\]?/g, '\t')
        .replace(/[\\]'[0-9a-fA-F]{2}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleanText) {
        this.loadContent(cleanText);
      } else {
        throw new Error('No text content found in RTF');
      }
    } catch (error) {
      console.error('Error loading RTF:', error);
      throw error;
    }
  }

  private async extractTextFromBinary(arrayBuffer: ArrayBuffer): Promise<string> {
    const uint8Array = new Uint8Array(arrayBuffer);
    let text = '';
    
    for (let i = 0; i < uint8Array.length; i++) {
      const char = uint8Array[i];
      if ((char >= 32 && char <= 126) || char === 10 || char === 13) {
        text += String.fromCharCode(char);
      }
    }
    
    return text.trim();
  }

  public loadContent(text: string) {
    this.text = text;
    this.words = text.split(/\s+/).filter(word => word.length > 0);
    this.currentIndex = 0;
    this.onTextChange?.(text);
    this.onProgressChange?.(this.currentIndex, this.words.length);
  }

  public start() {
    if (!this.words.length) return;

    this.isPlaying = true;
    const delay = 60000 / this.speed;
    
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
    }
    
    this.intervalId = window.setInterval(() => {
      if (this.currentIndex < this.words.length - 1) {
        this.currentIndex++;
        this.onProgressChange?.(this.currentIndex, this.words.length);
      } else {
        this.pause();
      }
    }, delay);
  }

  public pause() {
    this.isPlaying = false;
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  public setSpeed(wpm: number) {
    this.speed = Math.max(60, Math.min(1000, wpm));
    this.onSpeedChange?.(this.speed);
    if (this.isPlaying) {
      this.pause();
      this.start();
    }
  }

  public setCurrentIndex(index: number) {
    if (index >= 0 && index < this.words.length) {
      this.currentIndex = index;
            this.onProgressChange?.(this.currentIndex, this.words.length);
          }
  }

  public getCurrentWord(): string {
    return this.words[this.currentIndex] || '';
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getSpeed(): number {
    return this.speed;
  }

  public isReading(): boolean {
    return this.isPlaying;
  }

  public getWords(): string[] {
    return this.words;
  }
} 