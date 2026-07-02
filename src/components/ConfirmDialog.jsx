export default function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="recap-overlay" role="presentation" onClick={onCancel}>
      <section className="glass-panel confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onClick={(event) => event.stopPropagation()}>
        <h3 id="confirm-dialog-title">{title}</h3>
        {body ? <p>{body}</p> : null}
        <div className="settings-button-row">
          <button className={`action-btn-outline ${danger ? 'danger-button' : ''}`.trim()} type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="action-btn-outline" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
