import { useEffect } from 'react';

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * In-app replacement for window.confirm(), which — like prompt() and alert() —
 * is suppressed inside cross-origin iframes such as the ArcGIS Experience
 * Builder Embed widget. A suppressed confirm() returns false, so the guarded
 * action silently never runs.
 */
export default function ConfirmModal({ title, body, confirmLabel, onConfirm, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="reviewer-modal-overlay" onPointerDown={onClose}>
      <div className="reviewer-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="reviewer-modal-title">{title}</div>
        <div className="reviewer-modal-sub">{body}</div>
        <div className="reviewer-modal-actions">
          <button className="rm-cancel" onClick={onClose}>Cancel</button>
          <button className="rm-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
