import { useEffect, useRef, useState } from 'react';
import { copyText } from '../clipboard';

interface Props {
  filename: string;
  data: string;
  onClose: () => void;
}

/**
 * Copy-out delivery for the CSV/JSON export when the app is embedded.
 *
 * Chrome and Edge silently block script-initiated downloads inside a sandboxed
 * cross-origin iframe unless the host page sets `sandbox="... allow-downloads"`.
 * The ArcGIS Experience Builder Embed widget does not, and framed content
 * cannot grant itself the flag — the same class of restriction that already
 * forced the in-app ReviewerModal to replace window.prompt().
 *
 * Clipboard access is governed separately and does survive the sandbox, so
 * embedded reviewers copy the payload out instead of downloading it. At top
 * level the app downloads normally and this panel never opens.
 */
export default function ExportModal({ filename, data, onClose }: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    textRef.current?.focus();
    textRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async () => {
    setCopied(await copyText(data));
    window.setTimeout(() => setCopied(false), 2000);
  };

  const kb = Math.max(1, Math.round(new Blob([data]).size / 1024));

  return (
    <div className="reviewer-modal-overlay" onPointerDown={onClose}>
      <div className="export-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="reviewer-modal-title">{filename}</div>
        <div className="reviewer-modal-sub">
          {kb} KB. Downloads are blocked in this embedded view, so copy the data
          below and paste it into a new file named <b>{filename}</b>.
        </div>
        <textarea ref={textRef} readOnly value={data} spellCheck={false} />
        <div className="reviewer-modal-actions">
          <button className="rm-cancel" onClick={onClose}>Close</button>
          <button className="rm-save" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
        </div>
      </div>
    </div>
  );
}
