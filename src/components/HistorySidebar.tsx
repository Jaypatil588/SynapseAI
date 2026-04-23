import { useEffect, useState } from 'react';
import { fetchPastSessions, type DBSession } from '../lib/db';
import { formatTime } from '../lib/utils';

type HistorySidebarProps = {
  databaseUrl: string;
  currentSessionId: string | null;
  onSelectSession: (session: DBSession) => void;
};

export function HistorySidebar({ databaseUrl, currentSessionId, onSelectSession }: HistorySidebarProps) {
  const [sessions, setSessions] = useState<DBSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

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
    // Also poll history lightly so if we record a new one it pops up eventually
    const interval = window.setInterval(loadHistory, 60000);
    return () => window.clearInterval(interval);
  }, [databaseUrl]);

  if (isCollapsed) {
    return (
      <aside 
        className="history-sidebar" 
        style={{ width: '48px', cursor: 'pointer', background: '#f5f7f9', borderRight: '1px solid #d7e1e8', transition: 'width 0.2s ease' }} 
        onClick={() => setIsCollapsed(false)}
        title="Expand Past Sessions"
      >
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 'bold', color: '#4a6475', letterSpacing: '2px', opacity: 0.7 }}>
            ☰ PAST SESSIONS
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="history-sidebar" style={{ transition: 'width 0.2s ease', width: '260px' }}>
      <div className="history-sidebar__header">
        <h2>Past Sessions</h2>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button onClick={loadHistory} className="refresh-history-btn" disabled={isLoading} title="Refresh">
            ↻
          </button>
          <button onClick={() => setIsCollapsed(true)} className="refresh-history-btn" title="Collapse">
            ◀
          </button>
        </div>
      </div>

      {sessions.length === 0 && !isLoading && (
        <div className="history-empty">No past sessions found.</div>
      )}

      <ul className="history-list">
        {sessions.map((session) => {
          const isActive = session.id === currentSessionId;
          const snippet = session.transcript.length > 0 
            ? session.transcript[0].text.slice(0, 40) + '...'
            : 'Empty meeting';

          return (
            <li key={session.id} className={isActive ? 'active' : ''}>
              <button onClick={() => onSelectSession(session)}>
                <div className="session-time">{formatTime(session.created_at)}</div>
                <div className="session-snippet">{snippet}</div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
