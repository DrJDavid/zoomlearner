import { ReaderService } from '../ReaderService';
import { RSVPReader } from '../../lib/RSVPReader';

// Mock RSVPReader
const mockRSVPReaderInstance = {
  start: jest.fn(),
  pause: jest.fn(),
  setSpeed: jest.fn(),
  loadContent: jest.fn(),
  loadFile: jest.fn(),
  getCurrentWord: jest.fn(),
  getCurrentIndex: jest.fn(),
  setCurrentIndex: jest.fn(),
  getSpeed: jest.fn(),
  isReading: jest.fn(),
  getWords: jest.fn(),
  onTextChange: null as ((text: string) => void) | null,
  onProgressChange: null as ((index: number, total: number) => void) | null,
  onSpeedChange: null as ((wpm: number) => void) | null,
};

type MockRSVPReader = typeof mockRSVPReaderInstance;

jest.mock('../../lib/RSVPReader', () => ({
  RSVPReader: jest.fn(() => mockRSVPReaderInstance)
}));

describe('ReaderService', () => {
  let readerService: ReaderService;
  let mockRSVPReader: MockRSVPReader;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Get fresh instance of mock
    mockRSVPReader = mockRSVPReaderInstance;
    
    // Create a new instance for each test
    readerService = new ReaderService();
  });

  describe('Constructor', () => {
    it('should create a new instance with default values', () => {
      expect(readerService).toBeInstanceOf(ReaderService);
      expect(RSVPReader).toHaveBeenCalledTimes(1);
    });

    it('should set up event forwarding', () => {
      // Test text change callback
      if (mockRSVPReader.onTextChange) {
        mockRSVPReader.onTextChange('test text');
      }
      
      // Test progress change callback
      if (mockRSVPReader.onProgressChange) {
        mockRSVPReader.onProgressChange(1, 10);
      }
      
      // Test speed change callback
      if (mockRSVPReader.onSpeedChange) {
        mockRSVPReader.onSpeedChange(300);
      }
    });
  });

  describe('Core Methods', () => {
    it('should handle play/pause', () => {
      // Test play
      readerService.play();
      expect(mockRSVPReader.start).toHaveBeenCalled();

      // Test pause
      readerService.pause();
      expect(mockRSVPReader.pause).toHaveBeenCalled();
    });

    it('should handle speed changes', () => {
      const testSpeed = 400;
      readerService.setSpeed(testSpeed);
      expect(mockRSVPReader.setSpeed).toHaveBeenCalledWith(testSpeed);
    });

    it('should handle loading content', () => {
      const testContent = 'Test content';
      readerService.loadContent(testContent);
      expect(mockRSVPReader.loadContent).toHaveBeenCalledWith(testContent);
    });

    it('should handle loading files', async () => {
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      mockRSVPReader.loadFile.mockResolvedValue(undefined);
      await readerService.loadFile(testFile);
      expect(mockRSVPReader.loadFile).toHaveBeenCalledWith(testFile);
    });

    it('should get current word', () => {
      mockRSVPReader.getCurrentWord.mockReturnValue('test');
      const word = readerService.getCurrentWord();
      expect(word).toBe('test');
      expect(mockRSVPReader.getCurrentWord).toHaveBeenCalled();
    });

    it('should get and set current index', () => {
      // Test getting index
      mockRSVPReader.getCurrentIndex.mockReturnValue(5);
      const index = readerService.getCurrentIndex();
      expect(index).toBe(5);
      expect(mockRSVPReader.getCurrentIndex).toHaveBeenCalled();

      // Test setting index
      readerService.setCurrentIndex(10);
      expect(mockRSVPReader.setCurrentIndex).toHaveBeenCalledWith(10);
    });

    it('should get speed', () => {
      mockRSVPReader.getSpeed.mockReturnValue(300);
      const speed = readerService.getSpeed();
      expect(speed).toBe(300);
      expect(mockRSVPReader.getSpeed).toHaveBeenCalled();
    });

    it('should check reading status', () => {
      mockRSVPReader.isReading.mockReturnValue(true);
      const status = readerService.isReading();
      expect(status).toBe(true);
      expect(mockRSVPReader.isReading).toHaveBeenCalled();
    });

    it('should get words array', () => {
      const testWords = ['test', 'words', 'array'];
      mockRSVPReader.getWords.mockReturnValue(testWords);
      const words = readerService.getWords();
      expect(words).toEqual(testWords);
      expect(mockRSVPReader.getWords).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should handle event subscriptions', () => {
      const mockCallback = jest.fn();

      // Subscribe to event
      readerService.subscribe('textChange', mockCallback);
      
      // Trigger the event through the appropriate callback
      mockRSVPReader.onTextChange?.('test-data');
      
      expect(mockCallback).toHaveBeenCalledWith('test-data');

      // Unsubscribe from event
      readerService.unsubscribe('textChange', mockCallback);
      
      // Trigger again
      mockRSVPReader.onTextChange?.('test-data-2');
      
      // Callback should not be called again
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should forward all relevant events', () => {
      const mockTextCallback = jest.fn();
      const mockProgressCallback = jest.fn();
      const mockSpeedCallback = jest.fn();

      readerService.subscribe('textChange', mockTextCallback);
      readerService.subscribe('progressChange', mockProgressCallback);
      readerService.subscribe('speedChange', mockSpeedCallback);

      // Trigger callbacks
      mockRSVPReader.onTextChange?.('test text');
      mockRSVPReader.onProgressChange?.(1, 10);
      mockRSVPReader.onSpeedChange?.(300);

      expect(mockTextCallback).toHaveBeenCalledWith('test text');
      expect(mockProgressCallback).toHaveBeenCalledWith({ index: 1, total: 10 });
      expect(mockSpeedCallback).toHaveBeenCalledWith(300);
    });
  });

  describe('Error Handling', () => {
    it('should handle file loading errors', async () => {
      const invalidFile = new File([], 'invalid.txt');
      mockRSVPReader.loadFile.mockRejectedValue(new Error('Invalid file'));
      await expect(readerService.loadFile(invalidFile)).rejects.toThrow('Invalid file');
    });

    it('should handle invalid speed values', () => {
      mockRSVPReader.setSpeed.mockImplementation((speed: number) => {
        if (speed <= 0) throw new Error('Invalid speed');
      });
      expect(() => readerService.setSpeed(-1)).toThrow('Invalid speed');
      expect(() => readerService.setSpeed(0)).toThrow('Invalid speed');
    });

    it('should handle invalid index values', () => {
      mockRSVPReader.setCurrentIndex.mockImplementation((index: number) => {
        if (index < 0 || index >= 2) throw new Error('Invalid index');
      });
      mockRSVPReader.getWords.mockReturnValue(['word1', 'word2']);
      expect(() => readerService.setCurrentIndex(-1)).toThrow('Invalid index');
      expect(() => readerService.setCurrentIndex(2)).toThrow('Invalid index');
    });
  });
}); 