import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ChatProps {
  currentText: string;
  currentWordIndex: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const Chat: React.FC<ChatProps> = ({
  currentText,
  currentWordIndex,
  isExpanded,
  onToggleExpand,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      // Prepare context about the current reading
      const context = `Current reading progress: Word ${currentWordIndex + 1} of current text. 
                      Text excerpt around current position: "${getCurrentContext()}"`;

      const prompt = `${context}\n\nUser: ${userMessage}`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (error) {
      console.error('Error calling Gemini:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentContext = () => {
    const words = currentText.split(/\s+/);
    const start = Math.max(0, currentWordIndex - 10);
    const end = Math.min(words.length, currentWordIndex + 10);
    return words.slice(start, end).join(' ');
  };

  return (
    <div className={`chat-container ${isExpanded ? 'expanded' : ''}`}>
      <button 
        className="chat-toggle"
        onClick={onToggleExpand}
        aria-label={isExpanded ? 'Minimize chat' : 'Expand chat'}
      >
        {isExpanded ? '−' : '+'}
      </button>
      
      <div className="chat-content" ref={chatRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}`}>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-content loading">Thinking...</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your reading..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          Send
        </button>
      </form>
    </div>
  );
}; 