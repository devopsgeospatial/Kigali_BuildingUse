import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { COLORS, LABELS, ORDER } from '../constants';
import { DISTRICTS } from '../sectors';
import type { BFeature, ValidationRecord } from '../types';

const fmtArea = (m2: number) =>
  m2 >= 1e4 ? (m2 / 1e4).toFixed(2) + ' ha' : Math.round(m2).toLocaleString() + ' m²';

interface Props {
  feature: BFeature;
  initialX: number;
  initialY: number;
  existing?: ValidationRecord;
  reviewer: string;
  /** Ensures a reviewer name exists; returns it (or '' if cancelled). */
  ensureReviewer: () => string;
  onSave: (oid: number, rec: ValidationRecord) => void;
  onClose: () => void;
}

export default function DetailPanel({ feature, initialX, initialY, existing, reviewer, ensureReviewer, onSave, onClose }: Props) {
  const p = feature.properties;
  const oid = p.OBJECTID;
  const code = p.lu_cod_pred || '';
  const col = COLORS[code] || '#888';
  const hasH = p.Height != null && (p.Height as any) !== '' && (p.Height as any) !== 'null';
  const floors = hasH ? Math.max(1, p.estimated_floor || Math.round(Number(p.Height) / 3)) : 'n/a';

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [pick, setPick] = useState<'Yes' | 'No' | null>(existing ? existing.match : null);
  const [corrected, setCorrected] = useState(existing ? existing.corrected : '');
  const [needName, setNeedName] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);

  // place near the click, clamped inside the viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth || 300;
    const h = el.offsetHeight || 330;
    setPos({
      x: Math.max(8, Math.min(initialX + 16, window.innerWidth - w - 12)),
      y: Math.max(8, Math.min(initialY + 16, window.innerHeight - h - 12)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oid]);

  const onHeadPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('.x')) return;
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    const move = (ev: PointerEvent) =>
      setPos({
        x: Math.max(0, Math.min(ev.clientX - ox, window.innerWidth - 40)),
        y: Math.max(0, Math.min(ev.clientY - oy, window.innerHeight - 30)),
      });
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    e.preventDefault();
  };

  const canSave = pick === 'Yes' || (pick === 'No' && !!corrected);

  const handleSave = () => {
    let name = reviewer;
    if (!name) {
      name = ensureReviewer();
      if (!name) {
        setNeedName(true);
        return;
      }
    }
    const rec: ValidationRecord = {
      match: pick!,
      corrected: pick === 'No' ? corrected : '',
      upi: p.UPI,
      sector: p.sector,
      district: p.district || DISTRICTS[p.sector || ''] || '',
      predicted: code,
      predictedUse: p.Predicted_Use,
      reviewer: name,
      ts: Date.now(),
    };
    onSave(oid, rec);
    setSavedFlag(true);
    setTimeout(onClose, 650);
  };

  return (
    <div id="detail" className="show" ref={ref} style={{ left: pos.x, top: pos.y }}>
      <div id="detailHead" style={{ background: col }} onPointerDown={onHeadPointerDown}>
        <span>
          {LABELS[code] || p.Predicted_Use || code} <span className="upi">UPI {p.UPI || '—'}</span>
        </span>
        <span className="x" onClick={onClose}>
          ×
        </span>
      </div>
      <div id="detailBody">
        <div className="pp">
          <div className="bd">
            <div className="r"><span className="k">Sector</span><span className="v">{p.sector || '—'}</span></div>
            <div className="r"><span className="k">District</span><span className="v">{p.district || DISTRICTS[p.sector || ''] || '—'}</span></div>
            <div className="r"><span className="k">Height</span><span className="v">{hasH ? Number(p.Height).toFixed(1) + ' m' : 'n/a'}</span></div>
            <div className="r"><span className="k">Est. floors</span><span className="v">{floors}</span></div>
            <div className="r"><span className="k">Area</span><span className="v">{p.area != null ? fmtArea(Number(p.area)) : '—'}</span></div>
            <div className="r"><span className="k">Detected</span><span className="v">{p.acquisition_date || '—'}</span></div>
            <div className="usepair">
              <div className="u"><div className="ttl">Predicted use</div><div className="val">{p.Predicted_Use || '—'}</div></div>
              <div className="u"><div className="ttl">Planned use</div><div className="val">{p.Proposed_Use || '—'}</div></div>
            </div>
          </div>
          <div className="vbox">
            <div className="q">Does the predicted use match what's on the ground?</div>
            <div className="matchbtns">
              <button className={'yes' + (pick === 'Yes' ? ' on' : '')} onClick={() => setPick('Yes')}>✓ Matches</button>
              <button className={'no' + (pick === 'No' ? ' on' : '')} onClick={() => setPick('No')}>✗ Doesn't match</button>
            </div>
            <div className={'corrwrap' + (pick === 'No' ? ' show' : '')}>
              <label>Actual / corrected use</label>
              <select value={corrected} onChange={(e) => setCorrected(e.target.value)}>
                <option value="">— select actual use —</option>
                {ORDER.map((c) => (
                  <option key={c} value={c}>{LABELS[c]}</option>
                ))}
                <option value="OTHER">Other / unsure</option>
              </select>
            </div>
            <div className="vactions">
              <button className="save" disabled={!canSave || savedFlag} onClick={handleSave}>
                {savedFlag ? 'Saved ✓' : 'Save validation'}
              </button>
            </div>
            {needName && (
              <div className="needname" style={{ display: 'block' }}>
                Set a reviewer name first (top of panel ▸ "set reviewer").
              </div>
            )}
            {existing && (
              <div className="vstamp">
                ✓{' '}
                <span className="b">
                  {existing.match === 'Yes'
                    ? 'Matches'
                    : 'Mismatch' + (existing.corrected ? ' → ' + (LABELS[existing.corrected] || existing.corrected) : '')}
                </span>{' '}
                · {existing.reviewer || '?'} · {new Date(existing.ts).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
