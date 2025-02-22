import React from 'react';
import { render, act } from '@testing-library/react';
import { ReaderContext, ReaderProvider } from '../ReaderContext';
import { ReaderService } from '../../services/ReaderService';
import { AuthService } from '../../services/AuthService';

// Mock the services
jest.mock('../../services/ReaderService');
jest.mock('../../services/AuthService');

describe('ReaderContext', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Clear localStorage
    localStorage.clear();
  });

  it('should create context with default values', () => {
    const TestComponent = () => {
      const context = React.useContext(ReaderContext);
      expect(context).not.toBeNull();
      return null;
    };

    render(
      <ReaderProvider>
        <TestComponent />
      </ReaderProvider>
    );
  });

  it('should initialize services on mount', () => {
    render(
      <ReaderProvider>
        <div>Test</div>
      </ReaderProvider>
    );

    expect(ReaderService).toHaveBeenCalledTimes(1);
    expect(AuthService).toHaveBeenCalledTimes(1);
  });

  it('should handle dark mode toggle', () => {
    const TestComponent = () => {
      const context = React.useContext(ReaderContext);
      expect(context).not.toBeNull();
      if (!context) return null;

      return (
        <button onClick={context.toggleDarkMode}>
          {context.isDarkMode ? 'Dark' : 'Light'}
        </button>
      );
    };

    const { getByRole } = render(
      <ReaderProvider>
        <TestComponent />
      </ReaderProvider>
    );

    const button = getByRole('button');
    expect(button).toHaveTextContent('Light');

    act(() => {
      button.click();
    });

    expect(button).toHaveTextContent('Dark');
    expect(localStorage.getItem('darkMode')).toBe('true');
  });

  it('should handle reader controls', () => {
    const mockPlay = jest.fn();
    const mockPause = jest.fn();
    const mockSetSpeed = jest.fn();
    const mockLoadContent = jest.fn();

    // Mock the ReaderService implementation
    (ReaderService as jest.Mock).mockImplementation(() => ({
      play: mockPlay,
      pause: mockPause,
      setSpeed: mockSetSpeed,
      loadContent: mockLoadContent,
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    }));

    const TestComponent = () => {
      const context = React.useContext(ReaderContext);
      expect(context).not.toBeNull();
      if (!context) return null;

      return (
        <div>
          <button onClick={context.playReader}>Play</button>
          <button onClick={context.pauseReader}>Pause</button>
          <button onClick={() => context.setReaderSpeed(400)}>Speed</button>
          <button onClick={() => context.loadTextContent('test')}>Load</button>
        </div>
      );
    };

    const { getByText } = render(
      <ReaderProvider>
        <TestComponent />
      </ReaderProvider>
    );

    act(() => {
      getByText('Play').click();
    });
    expect(mockPlay).toHaveBeenCalled();

    act(() => {
      getByText('Pause').click();
    });
    expect(mockPause).toHaveBeenCalled();

    act(() => {
      getByText('Speed').click();
    });
    expect(mockSetSpeed).toHaveBeenCalledWith(400);

    act(() => {
      getByText('Load').click();
    });
    expect(mockLoadContent).toHaveBeenCalledWith('test');
  });

  it('should handle event subscriptions', () => {
    const mockSubscribe = jest.fn();
    const mockUnsubscribe = jest.fn();

    // Mock the ReaderService implementation
    (ReaderService as jest.Mock).mockImplementation(() => ({
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      play: jest.fn(),
      pause: jest.fn(),
      setSpeed: jest.fn(),
      loadContent: jest.fn(),
    }));

    const { unmount } = render(
      <ReaderProvider>
        <div>Test</div>
      </ReaderProvider>
    );

    expect(mockSubscribe).toHaveBeenCalledWith('play', expect.any(Function));
    expect(mockSubscribe).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(mockSubscribe).toHaveBeenCalledWith('speedChange', expect.any(Function));
    expect(mockSubscribe).toHaveBeenCalledWith('textChange', expect.any(Function));
    expect(mockSubscribe).toHaveBeenCalledWith('progressChange', expect.any(Function));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledWith('play', expect.any(Function));
    expect(mockUnsubscribe).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(mockUnsubscribe).toHaveBeenCalledWith('speedChange', expect.any(Function));
    expect(mockUnsubscribe).toHaveBeenCalledWith('textChange', expect.any(Function));
    expect(mockUnsubscribe).toHaveBeenCalledWith('progressChange', expect.any(Function));
  });
}); 