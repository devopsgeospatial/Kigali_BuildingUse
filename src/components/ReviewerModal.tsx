import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Current reviewer name, used to prefill the input. */
  current: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

/**
 * In-app replacement for window.prompt(). Native prompt()/alert()/confirm()
 * are blocked by browsers inside cross-origin iframes (e.g. ArcGIS Experience
 * Builder), so we render our own modal that works in any embedding context.
 */
export default function ReviewerModal({ current, onSave, onClose }: Props) {
  const [value, setValue] = useState(current);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const name = value.trim();
    if (name) onSave(name);
    else onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') onClose();
  };

  return (
    <div className="reviewer-modal-overlay" onPointerDown={onClose}>
      <div className="reviewer-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="reviewer-modal-title">Reviewer name</div>
        <div className="reviewer-modal-sub">
          Stored on this device, added to every decision.
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder="e.g. Gilbert U."
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="reviewer-modal-actions">
          <button className="rm-cancel" onClick={onClose}>Cancel</button>
          <button className="rm-save" onClick={commit} disabled={!value.trim()}>Save</button>
        </div>
      </div>
    </div>
  );
}
