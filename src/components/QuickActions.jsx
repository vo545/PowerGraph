export default function QuickActions({ actions, title = 'Actions', closeLabel = 'Close', searchLabel = 'Open search', onClose, onSearch, onRun }) {
  return (
    <div className="quick-actions-widget open">
      <div className="quick-actions-menu glass-panel">
        <div className="quick-actions-head">
          <strong>{title}</strong>
          <button className="context-help-btn" type="button" onClick={onClose} aria-label={closeLabel}>
            x
          </button>
        </div>
        <div className="quick-actions-grid">
          {actions.map((action) => (
            <button key={action.id} type="button" className="quick-action-mini" onClick={() => onRun(action)}>
              <span>{action.icon}</span>
              <strong>{action.label}</strong>
            </button>
          ))}
        </div>
        <button className="action-btn-outline full-width" type="button" onClick={onSearch}>
          {searchLabel}
        </button>
      </div>
    </div>
  );
}
