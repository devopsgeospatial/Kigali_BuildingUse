import { useEffect, useRef, useState } from 'react';

interface Props {
  filename: string;
  data: string;
  mime: string;
  /** Retry the normal browser download (works once the embed allows it). */
  onDownload: () => void;
  onClose: () => void;
}

/**
 * Fallback delivery for the CSV/JSON export.
 *
 * Chrome and Edge silently block script-initiated downloads inside a sandboxed
 * cross-origin iframe unless the host page sets `sandbox="... allow-downloads"`.
 * The ArcGIS Experience Builder Embed widget does not, so `a.download` is a
 * no-op there — the same restriction that already forced the in-app
 * ReviewerModal to replace window.prompt().
 *
 * There is no event that reports a blocked download, so when the app detects it
 * is embedded we still fire the download and additionally offer this panel:
 * the payload as selectable text, a clipboard copy, and a new-tab escape hatch.
 */
export default function ExportModal({ filename, data, mime, onDownload, onClose }: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

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
    // navigator.clipboard is gated behind the `clipboard-write` permission
    // policy, which embedders rarely grant; execCommand still works on a
    // selected textarea inside an iframe.
    try {
      await navigator.clipboard.writeText(data);
      setCopied(true);
    } catch {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      el.select();
      try { setCopied(document.execCommand('copy')); } catch { setCopied(false); }
    }
    window.setTimeout(() => setCopied(false), 2000);
  };

  // A blob URL is same-origin with this app, so a popup can display it even
  // when the sandbox forbids downloading it. Ctrl+S from there saves the file.
  const openTab = () => {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    // No 'noopener' in the feature string: it forces window.open() to return
    // null even on success, which would make the blocked-popup check useless.
    // Sever the back-reference manually instead.
    const win = window.open(url, '_blank');
    if (win) win.opener = null;
    // alert() is blocked in the same sandboxed contexts this modal exists for,
    // so report inline.
    else setError('The browser blocked the popup — allow popups for this site, or use Copy.');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const kb = Math.max(1, Math.round(new Blob([data]).size / 1024));

  return (
    <div className="reviewer-modal-overlay" onPointerDown={onClose}>
      <div className="export-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="reviewer-modal-title">{filename}</div>
        <div className="reviewer-modal-sub">
          If the download didn't start, this page is embedded somewhere that blocks
          downloads. Copy the {kb} KB below, or open it in a new tab and save from there.
        </div>
        <textarea ref={textRef} readOnly value={data} spellCheck={false} />
        {error && <div className="export-error">{error}</div>}
        <div className="reviewer-modal-actions">
          <button className="rm-cancel" onClick={onClose}>Close</button>
          <button className="rm-cancel" onClick={openTab}>Open in new tab</button>
          <button className="rm-cancel" onClick={onDownload}>Retry download</button>
          <button className="rm-save" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
        </div>
      </div>
    </div>
  );
}
