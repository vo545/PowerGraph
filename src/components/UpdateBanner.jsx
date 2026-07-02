export default function UpdateBanner({ message = 'New version available', actionLabel = 'Update now', dismissLabel = 'Dismiss', onUpdate, onDismiss }) {
  return (
    <div className="sw-update-banner" role="status" aria-live="polite">
      <span>{message}</span>
      <div className="sw-update-actions">
        <button className="action-btn-primary" type="button" onClick={onUpdate}>
          {actionLabel}
        </button>
        <button className="action-btn-outline sw-dismiss-btn" type="button" onClick={onDismiss} aria-label={dismissLabel}>
          x
        </button>
      </div>
    </div>
  );
}
