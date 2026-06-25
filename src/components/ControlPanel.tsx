import { SECTOR_LIST } from '../sectors';
import type { CityStats, Mode } from '../types';

export interface CompRow {
  key: string;
  label: string;
  color: string;
  count: number;
  pct: number;
  active: boolean;
}

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
  sectorFilter: string;
  onSector: (s: string) => void;
  city: CityStats | null;
  scopeLabel: string;
  compRows: CompRow[];
  compTotal: number;
  compTotalLabel: string;
  onToggleLegend: (key: string) => void;
  progress: { done: number; yes: number; no: number; corrected: number };
  reviewer: string;
  onSetReviewer: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onClear: () => void;
}

const MODES: [Mode, string][] = [
  ['use', 'Predicted use'],
  ['status', 'Validation status'],
  ['year', 'Detection year'],
];

const compact = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k' : String(n);
const pctOf = (a: number, b: number) => (b ? Math.round((100 * a) / b) + '%' : '—');

// group sectors by district, preserving SECTOR_LIST order
const GROUPS = SECTOR_LIST.reduce<Record<string, string[]>>((acc, s) => {
  (acc[s.d] = acc[s.d] || []).push(s.s);
  return acc;
}, {});

export default function ControlPanel(props: Props) {
  const { city } = props;
  return (
    <aside id="panel">
      <div className="brand">
        <h1>Kigali Building Detection and Land Use</h1>
        <div className="sub">
          Building footprint detection and land-use classification across the City of Kigali.
        </div>
        <div className="vcap">Model prediction</div>
      </div>

      <div id="panelScroll">
        <div className="sec">
          <h2>Colour buildings by</h2>
          <div className="modesw">
            {MODES.map(([m, label]) => (
              <button key={m} className={props.mode === m ? 'on' : ''} onClick={() => props.onMode(m)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="sec">
          <h2>Sector</h2>
          <select value={props.sectorFilter} onChange={(e) => props.onSector(e.target.value)}>
            <option value="ALL">All Kigali — 35 sectors</option>
            {Object.entries(GROUPS).map(([district, sectors]) => (
              <optgroup key={district} label={district + ' District'}>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="sec">
          <h2>
            City overview <span className="hint">{props.scopeLabel}</span>
          </h2>
          <div className="kpis">
            <div className="kpi">
              <div className="v">{(city?.total ?? 0).toLocaleString()}</div>
              <div className="l">Buildings</div>
            </div>
            <div className="kpi">
              <div className="v">{(city?.byYear?.['2025'] ?? 0).toLocaleString()}</div>
              <div className="l">New since 2023</div>
            </div>
            <div className="kpi">
              <div className="v sm">
                {pctOf(city?.withH ?? 0, city?.total ?? 0)}{' '}
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>({compact(city?.withH ?? 0)})</span>
              </div>
              <div className="l">With height estimate</div>
            </div>
            <div className="kpi">
              <div className="v sm">{(city?.ground ?? 0).toLocaleString()}</div>
              <div className="l">Ground-confirmed (source)</div>
            </div>
          </div>
        </div>

        <div className="sec">
          <h2>
            Live composition <span className="hint">click legend to filter</span>
          </h2>
          <div className="total">
            <span className="n">{props.compTotal.toLocaleString()}</span>
            <span className="l">{props.compTotalLabel}</span>
          </div>
          <div className="bar">
            {props.compRows
              .filter((r) => r.active && r.count > 0)
              .map((r) => (
                <span key={r.key} style={{ width: r.pct + '%', background: r.color }} />
              ))}
          </div>
          <div>
            {props.compRows.map((r) => (
              <div
                key={r.key}
                className={'legrow' + (r.active ? '' : ' off')}
                onClick={() => props.onToggleLegend(r.key)}
              >
                <span className="dot" style={{ background: r.color }} />
                <span className="nm">{r.label}</span>
                <span className="ct">{r.count.toLocaleString()}</span>
                <span className="pc">{r.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sec">
          <h2>Validation progress</h2>
          <div className="vp">
            <div className="ttl">
              This device{' '}
              <span className="who" style={{ cursor: 'pointer' }} onClick={props.onSetReviewer}>
                {props.reviewer || 'set reviewer ▸'}
              </span>
            </div>
            <div className="big">
              <span>{props.progress.done}</span> <small>decisions recorded</small>
            </div>
            <div className="vpsplit">
              <div>
                <div className="n" style={{ color: 'var(--ok)' }}>{props.progress.yes}</div>
                <div className="k">Matches</div>
              </div>
              <div>
                <div className="n" style={{ color: 'var(--bad)' }}>{props.progress.no}</div>
                <div className="k">Mismatch</div>
              </div>
              <div>
                <div className="n" style={{ color: 'var(--accent)' }}>{props.progress.corrected}</div>
                <div className="k">Corrected</div>
              </div>
            </div>
            <div className="vpbtns">
              <button onClick={props.onExportCsv}>⬇ Export CSV</button>
              <button onClick={props.onExportJson}>⬇ JSON</button>
              <button className="danger" onClick={props.onClear}>
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="note">
          <b>How to validate.</b> Click any building on the map. In the popup choose <b>Matches</b> or{' '}
          <b>Doesn't match</b>; if it doesn't match, pick the building's actual use. Decisions are stored in this
          browser and can be exported to CSV for the data team. Colours are model <i>predictions</i> — a screening
          layer to prioritise field review.
        </div>
      </div>
    </aside>
  );
}
