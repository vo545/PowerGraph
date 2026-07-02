export default function EmptyState({ title, body, actionLabel, onAction, icon }) {
  return (
    <div className="empty-state">
      {icon ? <p className="empty-state-icon">{icon}</p> : null}
      {title ? <h4>{title}</h4> : null}
      {body ? <p>{body}</p> : null}
      {actionLabel && onAction ? (
        <button className="action-btn-outline empty-state-action" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
