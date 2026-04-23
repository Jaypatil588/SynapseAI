type TopNavProps = {
  activeTab: 'dashboard' | 'session';
  onOpenSettings: () => void;
};

export function TopNav({ activeTab, onOpenSettings }: TopNavProps) {
  return (
    <nav className="top-nav">
      <div className="top-nav__links">
        <button className={`top-nav__link ${activeTab === 'dashboard' ? 'active' : ''}`}>
          Dashboard
        </button>
        <button className="top-nav__link">Labs</button>
        <button className="top-nav__link" onClick={onOpenSettings}>
          Health & Support
        </button>
        <button className="top-nav__link">Core</button>
      </div>
      <div className="top-nav__actions">
        <button className="top-nav__notification" title="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#f59e0b' }}>
            <circle cx="12" cy="12" r="6" />
          </svg>
        </button>
        <div className="top-nav__avatar" title="Profile">
          <div style={{ 
            width: '100%', 
            height: '100%', 
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '0.85rem',
            fontWeight: 600
          }}>
            U
          </div>
        </div>
      </div>
    </nav>
  );
}
