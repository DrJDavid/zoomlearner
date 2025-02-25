import React, { useState, useEffect } from 'react';
import { AIService } from '../lib/ai';

interface AIFeaturesDemoProps {
  readingSessionId?: string;
  currentText?: string;
}

const AIFeaturesDemo: React.FC<AIFeaturesDemoProps> = ({ readingSessionId, currentText }) => {
  const [message, setMessage] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [summary, setSummary] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState<{
    chat: boolean;
    summary: boolean;
    quiz: boolean;
  }>({
    chat: false,
    summary: false,
    quiz: false
  });
  const [aiService] = useState(() => new AIService({
    readingSessionId,
    currentText
  }));

  useEffect(() => {
    // Update context if props change
    aiService.updateContext({
      readingSessionId,
      currentText
    });
  }, [readingSessionId, currentText, aiService]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    setLoading(prev => ({ ...prev, chat: true }));
    try {
      const response = await aiService.sendMessage(message);
      setChatResponse(response);
    } catch (error) {
      console.error('Error sending message:', error);
      setChatResponse('Error: Failed to get AI response. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, chat: false }));
    }
  };

  const handleGenerateSummary = async () => {
    if (!readingSessionId) {
      setSummary('Error: No reading session selected');
      return;
    }
    
    setLoading(prev => ({ ...prev, summary: true }));
    try {
      const summaryResult = await aiService.generateSummary(readingSessionId);
      setSummary(summaryResult);
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummary('Error: Failed to generate summary. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, summary: false }));
    }
  };

  const handleGenerateQuiz = async () => {
    if (!readingSessionId) {
      setQuestions([]);
      return;
    }
    
    setLoading(prev => ({ ...prev, quiz: true }));
    try {
      const quizResult = await aiService.generateQuiz(readingSessionId);
      setQuestions(quizResult.questions || []);
    } catch (error) {
      console.error('Error generating quiz:', error);
      setQuestions([]);
    } finally {
      setLoading(prev => ({ ...prev, quiz: false }));
    }
  };

  return (
    <div className="ai-features-demo">
      <h2>AI Features Demo</h2>
      
      <div className="chat-section">
        <h3>Chat with AI</h3>
        <div className="input-group">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask a question about your reading..."
            disabled={loading.chat}
          />
          <button onClick={handleSendMessage} disabled={loading.chat}>
            {loading.chat ? 'Sending...' : 'Send'}
          </button>
        </div>
        
        {chatResponse && (
          <div className="response-box">
            <strong>AI Response:</strong>
            <p>{chatResponse}</p>
          </div>
        )}
      </div>
      
      <div className="summary-section">
        <h3>Generate Summary</h3>
        <button onClick={handleGenerateSummary} disabled={loading.summary || !readingSessionId}>
          {loading.summary ? 'Generating...' : 'Generate Summary'}
        </button>
        
        {summary && (
          <div className="response-box">
            <strong>Summary:</strong>
            <p>{summary}</p>
          </div>
        )}
      </div>
      
      <div className="quiz-section">
        <h3>Generate Quiz</h3>
        <button onClick={handleGenerateQuiz} disabled={loading.quiz || !readingSessionId}>
          {loading.quiz ? 'Generating...' : 'Generate Quiz'}
        </button>
        
        {questions.length > 0 && (
          <div className="response-box">
            <strong>Quiz Questions:</strong>
            <ol>
              {questions.map((q, i) => (
                <li key={i}>
                  <p>{q.question}</p>
                  <ul>
                    {q.options.map((option: string, j: number) => (
                      <li key={j} style={q.correct_option === j ? { fontWeight: 'bold' } : {}}>
                        {option} {q.correct_option === j && '✓'}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIFeaturesDemo; 