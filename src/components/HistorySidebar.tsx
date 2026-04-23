import { useEffect, useState } from 'react';
import { fetchPastSessions, type DBSession } from '../lib/db';
import { formatTime } from '../lib/utils';

type HistorySidebarProps = {
  databaseUrl: string;
  currentSessionId: string | null;
  onSelectSession: (session: DBSession) => void;
  onNewChat: () => void;
  activeView: 'dashboard' | 'session';
};

export function HistorySidebar({ 
  databaseUrl, 
  currentSessionId, 
  onSelectSession, 
  onNewChat,
  activeView 
}: HistorySidebarProps) {
  const [sessions, setSessions] = useState<DBSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function loadHistory() {
    setIsLoading(true);
    try {
      const history = await fetchPastSessions(databaseUrl);
      setSessions(history);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
    const interval = window.setInterval(loadHistory, 60000);
    return () => window.clearInterval(interval);
  }, [databaseUrl]);

  // Group sessions by date
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todaySessions = sessions.filter(s => {
    const date = new Date(s.created_at);
    return date.toDateString() === today.toDateString();
  });

  const yesterdaySessions = sessions.filter(s => {
    const date = new Date(s.created_at);
    return date.toDateString() === yesterday.toDateString();
  });

  const olderSessions = sessions.filter(s => {
    const date = new Date(s.created_at);
    return date.toDateString() !== today.toDateString() && 
           date.toDateString() !== yesterday.toDateString();
  });

  return (
    <aside className="history-sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#f59e0b' }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
          </svg>
        </div>
        <span className="sidebar-logo__text">SynapseAI</span>
        <button className="sidebar-search" style={{ marginLeft: 'auto' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </div>

      {/* New Chat Button */}
      <button className="new-chat-btn" onClick={onNewChat}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New Chat
      </button>

      {/* Features Section */}
      <div className="sidebar-section">
        <h3 className="sidebar-section__title">Features</h3>
        <button className={`sidebar-nav-item ${activeView === 'session' ? 'active' : ''}`}>
          <svg className="sidebar-nav-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          AI Chat
        </button>
        <button className="sidebar-nav-item">
          <svg className="sidebar-nav-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          Library
        </button>
      </div>

      {/* Today Sessions */}
      {todaySessions.length > 0 && (
        <div className="sidebar-section">
          <h3 className="sidebar-section__title">Today</h3>
          <ul className="history-list">
            {todaySessions.slice(0, 5).map((session) => {
              const isActive = session.id === currentSessionId;
              const snippet = session.transcript.length > 0 
                ? session.transcript[0].text.slice(0, 35) + '...'
                : 'Empty meeting';

              return (
                <li key={session.id} className={isActive ? 'active' : ''}>
                  <button onClick={() => onSelectSession(session)}>
                    {snippet}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Yesterday Sessions */}
      {yesterdaySessions.length > 0 && (
        <div className="sidebar-section">
          <h3 className="sidebar-section__title">Yesterday</h3>
          <ul className="history-list">
            {yesterdaySessions.slice(0, 3).map((session) => {
              const isActive = session.id === currentSessionId;
              const snippet = session.transcript.length > 0 
                ? session.transcript[0].text.slice(0, 35) + '...'
                : 'Empty meeting';

              return (
                <li key={session.id} className={isActive ? 'active' : ''}>
                  <button onClick={() => onSelectSession(session)}>
                    {snippet}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Placeholder history items when no sessions */}
      {sessions.length === 0 && !isLoading && (
        <>
          <div className="sidebar-section">
            <h3 className="sidebar-section__title">Today</h3>
            <ul className="history-list">
              <li><button>Craft a nostalgic dashboard UI</button></li>
              <li><button>Build a neon-drenched cityscape</button></li>
              <li><button>Create a digital vintage timepiece</button></li>
              <li><button>{"Design a 70s-inspired interior mock..."}</button></li>
              <li><button>Reimagine a classic desktop interface</button></li>
            </ul>
          </div>
          <div className="sidebar-section">
            <h3 className="sidebar-section__title">Yesterday</h3>
            <ul className="history-list">
              <li><button>Generated retro visual assets</button></li>
              <li><button>Ran test for custom enterprise tool</button></li>
              <li><button>Exported records from data vault</button></li>
            </ul>
          </div>
        </>
      )}

      {/* Upgrade Card */}
      <div className="upgrade-card">
        <div className="upgrade-card__avatars">
          <div className="upgrade-card__avatar" style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="upgrade-card__avatar" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="upgrade-card__avatar" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
        <h4 className="upgrade-card__title">Upgrade to Pro</h4>
        <p className="upgrade-card__desc">Get more tools, faster AI, and exclusive features</p>
        <button className="upgrade-card__btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v1m0 16v1m-8-9H3m18 0h-1M5.6 5.6l.7.7m12.4 12.4-.7-.7m0-12.4-.7.7M5.6 18.4l.7-.7" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          </svg>
          Upgrade
        </button>
      </div>
    </aside>
  );
}
