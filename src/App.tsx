import { useEffect, useMemo, useRef, useState } from 'react';
import ControlPanel, { type CompRow } from './components/ControlPanel';
import MapView from './components/MapView';
import DetailPanel from './components/DetailPanel';
import {
  COLORS,
  DATE_COLORS,
  LABELS,
  ORDER,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
  YEAR_ORDER,
} from './constants';
import { loadOverview } from './featureService';
import { loadReviewer, loadValidations, saveReviewer, saveValidations } from './validationStore';
import type { BFeature, Basemap, CityStats, Mode, ValidationRecord, Validations } from './types';

/* ---- composition (live bars + legend) ---- */
function computeComposition(
  mode: Mode,
  city: CityStats | null,
  features: BFeature[],
  sectorFilter: string,
  activeUse: string[],
  activeYear: string[],
  activeStatus: string[],
): { rows: CompRow[]; total: number; totalLabel: string } {
  let keys: string[];
  let labelOf: (k: string) => string;
  let colorOf: (k: string) => string;
  let active: string[];
  const counts: Record<string, number> = {};
  let totalLabel = 'buildings in view';

  if (mode === 'use') {
    keys = ORDER;
    labelOf = (k) => LABELS[k];
    colorOf = (k) => COLORS[k];
    active = activeUse;
    keys.forEach((k) => (counts[k] = 0));
    if (features.length) features.forEach((f) => { const c = f.properties.lu_cod_pred; if (c && c in counts) counts[c]++; });
    else { keys.forEach((k) => (counts[k] = city?.byUse?.[k] ?? 0)); totalLabel = `buildings (whole ${sectorFilter === 'ALL' ? 'city' : 'sector'})`; }
  } else if (mode === 'year') {
    keys = YEAR_ORDER;
    labelOf = (k) => 'Detected ' + k;
    colorOf = (k) => DATE_COLORS[k];
    active = activeYear;
    keys.forEach((k) => (counts[k] = 0));
    if (features.length) features.forEach((f) => { const y = f.properties.acquisition_date; if (y && y in counts) counts[y]++; });
    else { keys.forEach((k) => (counts[k] = city?.byYear?.[k] ?? 0)); totalLabel = `buildings (whole ${sectorFilter === 'ALL' ? 'city' : 'sector'})`; }
  } else {
    keys = STATUS_ORDER;
    labelOf = (k) => STATUS_LABELS[k as keyof typeof STATUS_LABELS];
    colorOf = (k) => STATUS_COLORS[k as keyof typeof STATUS_COLORS];
    active = activeStatus;
    keys.forEach((k) => (counts[k] = 0));
    features.forEach((f) => { const s = f.properties._vs; if (s) counts[s]++; });
  }

  let grand = 0;
  keys.forEach((k) => (grand += counts[k] || 0));
  let total = 0;
  keys.forEach((k) => { if (active.includes(k)) total += counts[k] || 0; });

  const rows: CompRow[] = keys.map((k) => ({
    key: k,
    label: labelOf(k),
    color: colorOf(k),
    count: counts[k] || 0,
    pct: grand ? (100 * (counts[k] || 0)) / grand : 0,
    active: active.includes(k),
  }));
  return { rows, total, totalLabel };
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
function download(name: string, data: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function App() {
  const [mode, setMode] = useState<Mode>('use');
  const [basemap, setBasemap] = useState<Basemap>('sat');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [activeUse, setActiveUse] = useState<string[]>([...ORDER]);
  const [activeYear, setActiveYear] = useState<string[]>(['2023', '2025']);
  const [activeStatus, setActiveStatus] = useState<string[]>(['match', 'mismatch', 'none']);

  const [validations, setValidations] = useState<Validations>(() => loadValidations());
  const [reviewer, setReviewer] = useState<string>(() => loadReviewer());

  const [city, setCity] = useState<CityStats | null>(null);
  const [viewportFeatures, setViewportFeatures] = useState<BFeature[]>([]);
  const [detail, setDetail] = useState<{ feature: BFeature; x: number; y: number } | null>(null);

  const [toast, setToast] = useState<{ ic: string; msg: string } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = (ic: string, msg: string) => {
    setToast({ ic, msg });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  /* citywide / per-sector overview */
  useEffect(() => {
    const where = sectorFilter === 'ALL' ? '1=1' : `sector='${sectorFilter.replace(/'/g, "''")}'`;
    let cancelled = false;
    loadOverview(where)
      .then((c) => { if (!cancelled) setCity(c); })
      .catch((e) => console.error('overview failed', e));
    return () => { cancelled = true; };
  }, [sectorFilter]);

  const comp = useMemo(
    () => computeComposition(mode, city, viewportFeatures, sectorFilter, activeUse, activeYear, activeStatus),
    [mode, city, viewportFeatures, sectorFilter, activeUse, activeYear, activeStatus],
  );

  const progress = useMemo(() => {
    const vals = Object.values(validations);
    return {
      done: vals.length,
      yes: vals.filter((v) => v.match === 'Yes').length,
      no: vals.filter((v) => v.match === 'No').length,
      corrected: vals.filter((v) => v.corrected && v.corrected !== '').length,
    };
  }, [validations]);

  const toggleLegend = (key: string) => {
    const toggle = (arr: string[]) => (arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);
    if (mode === 'use') setActiveUse(toggle);
    else if (mode === 'year') setActiveYear(toggle);
    else setActiveStatus(toggle);
  };

  const ensureReviewer = (): string => {
    if (reviewer) return reviewer;
    const n = window.prompt('Reviewer name (stored on this device, added to every decision):', '');
    if (n && n.trim()) {
      const name = n.trim();
      setReviewer(name);
      saveReviewer(name);
      return name;
    }
    return '';
  };
  const promptReviewer = () => {
    const n = window.prompt('Reviewer name (stored on this device, added to every decision):', reviewer || '');
    if (n && n.trim()) {
      setReviewer(n.trim());
      saveReviewer(n.trim());
    }
  };

  const saveValidation = (oid: number, rec: ValidationRecord) => {
    setValidations((prev) => {
      const next = { ...prev, [oid]: rec };
      saveValidations(next);
      return next;
    });
    showToast('✓', 'Validation saved');
  };

  const exportCsv = () => {
    const rows: string[][] = [[
      'OBJECTID', 'UPI', 'sector', 'district', 'predicted_code', 'predicted_use',
      'match_ground', 'corrected_code', 'corrected_use', 'reviewer', 'timestamp',
    ]];
    Object.entries(validations).forEach(([oid, v]) =>
      rows.push([
        oid, v.upi || '', v.sector || '', v.district || '', v.predicted || '', v.predictedUse || '',
        v.match || '', v.corrected || '', v.corrected ? LABELS[v.corrected] || v.corrected : '',
        v.reviewer || '', new Date(v.ts).toISOString(),
      ]),
    );
    if (rows.length === 1) { showToast('!', 'No validations to export yet'); return; }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    download('sparc_validations_' + stamp() + '.csv', csv, 'text/csv');
  };
  const exportJson = () => {
    if (!Object.keys(validations).length) { showToast('!', 'No validations to export yet'); return; }
    download('sparc_validations_' + stamp() + '.json', JSON.stringify(validations, null, 2), 'application/json');
  };
  const clearAll = () => {
    const n = Object.keys(validations).length;
    if (!n) { showToast('!', 'Nothing to clear'); return; }
    if (window.confirm(`Clear all ${n} validations stored on this device? Export first if you need them.`)) {
      setValidations({});
      saveValidations({});
      showToast('✓', 'Cleared');
    }
  };

  return (
    <div id="app">
      <ControlPanel
        mode={mode}
        onMode={setMode}
        sectorFilter={sectorFilter}
        onSector={setSectorFilter}
        city={city}
        scopeLabel={sectorFilter === 'ALL' ? 'all sectors' : sectorFilter}
        compRows={comp.rows}
        compTotal={comp.total}
        compTotalLabel={comp.totalLabel}
        onToggleLegend={toggleLegend}
        progress={progress}
        reviewer={reviewer}
        onSetReviewer={promptReviewer}
        onExportCsv={exportCsv}
        onExportJson={exportJson}
        onClear={clearAll}
      />

      <MapView
        mode={mode}
        basemap={basemap}
        sectorFilter={sectorFilter}
        activeUse={activeUse}
        activeYear={activeYear}
        activeStatus={activeStatus}
        validations={validations}
        onBasemap={setBasemap}
        onSelect={(feature, x, y) => setDetail({ feature, x, y })}
        onViewportFeatures={(features) => setViewportFeatures(features)}
      />

      {detail && (
        <DetailPanel
          key={detail.feature.properties.OBJECTID}
          feature={detail.feature}
          initialX={detail.x}
          initialY={detail.y}
          existing={validations[detail.feature.properties.OBJECTID]}
          reviewer={reviewer}
          ensureReviewer={ensureReviewer}
          onSave={saveValidation}
          onClose={() => setDetail(null)}
        />
      )}

      {toast && (
        <div id="toast" className="show">
          <span className="ic">{toast.ic}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
