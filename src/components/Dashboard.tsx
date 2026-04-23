import { useState } from 'react';

type DashboardProps = {
  onStartSession: () => void;
  onOpenSettings: () => void;
};

export function Dashboard({ onStartSession, onOpenSettings }: DashboardProps) {
  const [inputValue, setInputValue] = useState('');

  const featureCards = [
    {
      title: 'Launch Your AI Assistant',
      description: 'Create a custom AI assistant with skills and workflows built for your unique needs.',
      link: 'Learn more',
    },
    {
      title: 'Fine-tune a model',
      description: 'Train an AI model using your data to deliver smarter, tailored results.',
      link: 'Learn more',
    },
    {
      title: 'API Requests',
      description: 'Send your first API call and unlock powerful integrations with just a few lines.',
      link: 'Learn more',
    },
    {
      title: 'Download & Self-Deployment of models',
      description: 'Browse and deploy open-source models directly to your environment.',
      link: 'Learn more',
    },
  ];

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onStartSession();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="dashboard-view">
      {/* Brain Icon */}
      <div className="dashboard-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#f59e0b' }}>
          <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
          <path d="M9 21h6" />
          <path d="M12 17v4" />
          <circle cx="12" cy="9" r="1" fill="currentColor" />
          <path d="M9 9a3 3 0 0 1 6 0" />
          <path d="M8 12c-.5-.5-1-1.5-1-3" />
          <path d="M16 12c.5-.5 1-1.5 1-3" />
        </svg>
      </div>

      {/* Welcome Text */}
      <div className="dashboard-welcome">
        <p className="dashboard-welcome__greeting">
          Welcome Back
          <span style={{ color: '#f59e0b' }}>&#10024;</span>
        </p>
        <h1 className="dashboard-welcome__title">What Can I Help You Create Today?</h1>
      </div>

      {/* Chat Input */}
      <div className="chat-input-container">
        <textarea
          className="chat-input-field"
          placeholder="Ask anything ..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <div className="chat-input-actions">
          <div className="chat-input-buttons">
            <button className="chat-action-btn" onClick={onStartSession}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              Search
            </button>
            <button className="chat-action-btn" onClick={onOpenSettings}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
              Create Image
            </button>
            <button className="chat-action-btn chat-action-btn--more">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          </div>
          <div className="chat-input-right">
            <button className="chat-sparkle-btn" title="AI Settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v1m0 16v1m-8-9H3m18 0h-1M5.6 5.6l.7.7m12.4 12.4-.7-.7m0-12.4-.7.7M5.6 18.4l.7-.7" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </button>
            <button 
              className="chat-submit-btn" 
              onClick={handleSubmit}
              disabled={!inputValue.trim()}
              title="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="feature-section">
        <h2 className="feature-section__title">Kickstart Your Journey with These Tools</h2>
        <div className="feature-grid">
          {featureCards.map((card, index) => (
            <div key={index} className="feature-card" onClick={onStartSession}>
              <h3 className="feature-card__title">{card.title}</h3>
              <p className="feature-card__desc">{card.description}</p>
              <button className="feature-card__link">
                {card.link}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
