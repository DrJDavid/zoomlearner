export class RSVPReader {
  private text: string = '';
  private words: string[] = [];
  private currentIndex: number = 0;
  private speed: number = 300;
  private isPlaying: boolean = false;

  onTextChange: ((text: string) => void) | null = null;
  onProgressChange: ((index: number, total: number) => void) | null = null;
  onSpeedChange: ((wpm: number) => void) | null = null;

  start(): void {
    this.isPlaying = true;
  }

  pause(): void {
    this.isPlaying = false;
  }

  setSpeed(wpm: number): void {
    if (wpm <= 0) throw new Error('Invalid speed');
    this.speed = wpm;
    if (this.onSpeedChange) this.onSpeedChange(wpm);
  }

  loadContent(text: string): void {
    this.text = text;
    this.words = text.split(/\s+/);
    this.currentIndex = 0;
    if (this.onTextChange) this.onTextChange(text);
    if (this.onProgressChange) this.onProgressChange(0, this.words.length);
  }

  async loadFile(file: File): Promise<void> {
    if (file.size === 0) throw new Error('Invalid file');
    const text = await file.text();
    this.loadContent(text);
  }

  getCurrentWord(): string {
    return this.words[this.currentIndex] || '';
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  setCurrentIndex(index: number): void {
    if (index < 0 || index >= this.words.length) {
      throw new Error('Invalid index');
    }
    this.currentIndex = index;
    if (this.onProgressChange) this.onProgressChange(index, this.words.length);
  }

  getSpeed(): number {
    return this.speed;
  }

  isReading(): boolean {
    return this.isPlaying;
  }

  getWords(): string[] {
    return this.words;
  }
} 