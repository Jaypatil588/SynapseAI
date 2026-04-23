type TopNavProps = {
  activeTab: 'dashboard' | 'session';
  onOpenSettings: () => void;
};

export function TopNav({ activeTab, onOpenSettings }: TopNavProps) {
  return (
    <nav className="top-nav" style={{ justifyContent: 'space-between' }}>
      <div className="top-nav__links">
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          TwinMind
        </h2>
      </div>
      <div className="top-nav__actions">
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          - Jay Patil
        </span>
      </div>
    </nav>
  );
}
