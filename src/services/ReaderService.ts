import { RSVPReader } from '../lib/RSVPReader';
import { EventEmitter } from '../lib/EventEmitter';

/**
 * Service wrapper for RSVPReader that adds event handling and React integration
 * This service maintains compatibility with the existing implementation while
 * adding new functionality for the React migration.
 */
export class ReaderService {
  private reader: RSVPReader;
  private eventEmitter: EventEmitter;

  constructor() {
    // Initially use the existing reader instance if available
    // This allows us to maintain state during the migration
    this.reader = new RSVPReader();
    this.eventEmitter = new EventEmitter();

    // Forward reader callbacks to events
    this.reader.onTextChange = (text: string) => {
      this.eventEmitter.emit('textChange', text);
    };

    this.reader.onProgressChange = (index: number, total: number) => {
      this.eventEmitter.emit('progressChange', { index, total });
    };

    this.reader.onSpeedChange = (wpm: number) => {
      this.eventEmitter.emit('speedChange', wpm);
    };
  }

  /**
   * Start reading from the current position
   */
  play(): void {
    this.reader.start();
    this.eventEmitter.emit('play');
  }

  /**
   * Pause reading at the current position
   */
  pause(): void {
    this.reader.pause();
    this.eventEmitter.emit('pause');
  }

  /**
   * Set the reading speed in words per minute
   */
  setSpeed(wpm: number): void {
    this.reader.setSpeed(wpm);
    // Note: no need to emit 'speedChange' here as it's handled by the callback
  }

  /**
   * Load new text content into the reader
   */
  loadContent(text: string): void {
    this.reader.loadContent(text);
    // Note: no need to emit 'textChange' here as it's handled by the callback
  }

  /**
   * Load content from a file
   */
  async loadFile(file: File): Promise<void> {
    await this.reader.loadFile(file);
  }

  /**
   * Get the current word being displayed
   */
  getCurrentWord(): string {
    return this.reader.getCurrentWord();
  }

  /**
   * Get the current word index
   */
  getCurrentIndex(): number {
    return this.reader.getCurrentIndex();
  }

  /**
   * Set the current word index
   */
  setCurrentIndex(index: number): void {
    this.reader.setCurrentIndex(index);
  }

  /**
   * Get the current reading speed in WPM
   */
  getSpeed(): number {
    return this.reader.getSpeed();
  }

  /**
   * Check if the reader is currently playing
   */
  isReading(): boolean {
    return this.reader.isReading();
  }

  /**
   * Get the array of words from the current text
   */
  getWords(): string[] {
    return this.reader.getWords();
  }

  /**
   * Subscribe to reader events
   * @param event The event to subscribe to
   * @param callback The callback to execute when the event occurs
   */
  subscribe(event: string, callback: (...args: any[]) => void): void {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Unsubscribe from reader events
   * @param event The event to unsubscribe from
   * @param callback The callback to remove
   */
  unsubscribe(event: string, callback: (...args: any[]) => void): void {
    this.eventEmitter.off(event, callback);
  }
} 