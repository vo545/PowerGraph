import { useEffect, useRef } from 'react';

export default function QuickActions({ actions, title = 'Actions', closeLabel = 'Close', searchLabel = 'Open search', onClose, onSearch, onRun }) {
  const menuRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const focusId = window.setTimeout(() => {
      menuRef.current?.querySelector('.quick-action-mini:not(:disabled)')?.focus({ preventScroll: true });
    }, 30);

    const closeOnOutsidePointer = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.quick-actions-menu') || target.closest('.quick-open-btn')) return;
      onCloseRef.current?.();
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      window.clearTimeout(focusId);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [actions.length]);

  const focusRelativeAction = (direction) => {
    const buttons = Array.from(menuRef.current?.querySelectorAll('button:not(:disabled)') || []);
    if (!buttons.length) return;
    const currentIndex = buttons.indexOf(document.activeElement);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      focusRelativeAction(1);
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      focusRelativeAction(-1);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      menuRef.current?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    }
    if (event.key === 'End') {
      event.preventDefault();
      const buttons = menuRef.current?.querySelectorAll('button:not(:disabled)');
      buttons?.[buttons.length - 1]?.focus({ preventScroll: true });
    }
  };

  const runAction = (action) => {
    onRun?.(action);
    onClose?.();
  };

  return (
    <div className="quick-actions-widget open">
      <div
        className="quick-actions-menu glass-panel"
        ref={menuRef}
        role="dialog"
        aria-label={title}
        onKeyDown={handleKeyDown}
      >
        <div className="quick-actions-head">
          <strong>{title}</strong>
          <button className="context-help-btn" type="button" onClick={onClose} aria-label={closeLabel}>
            x
          </button>
        </div>
        <div className="quick-actions-grid">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="quick-action-mini"
              onClick={() => runAction(action)}
              aria-label={action.description ? `${action.label}. ${action.description}` : action.label}
            >
              <span aria-hidden="true">{action.icon}</span>
              <span className="quick-action-copy">
                <strong>{action.label}</strong>
                {action.description ? <small>{action.description}</small> : null}
              </span>
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
