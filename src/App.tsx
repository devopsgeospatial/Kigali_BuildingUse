import { useEffect, useMemo, useRef, useState } from 'react';
import ControlPanel, { type CompRow } from './components/ControlPanel';
import MapView from './components/MapView';
import DetailPanel from './components/DetailPanel';
import ReviewerModal from './components/ReviewerModal';
import ExportModal from './components/ExportModal';
import ConfirmModal from './components/ConfirmModal';
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

/** True when the app is running inside an iframe (e.g. an Experience Builder
 *  Embed widget), where script-initiated downloads are usually sandboxed off. */
function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin parent — the throw itself proves we are framed.
    return true;
  }
}

function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  // Firefox only dispatches the click if the anchor is in the document, and
  // the download is asynchronous — revoking the URL on the next line cancels
  // it in some browsers, so defer the revoke well past the click.
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 60000);
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
  const [reviewerModalOpen, setReviewerModalOpen] = useState(false);

  const [city, setCity] = useState<CityStats | null>(null);
  const [viewportFeatures, setViewportFeatures] = useState<BFeature[]>([]);
  const [detail, setDetail] = useState<{ feature: BFeature; x: number; y: number } | null>(null);

  const [exportPayload, setExportPayload] =
    useState<{ filename: string; data: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

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

  // Returns the current reviewer if set; otherwise opens the modal and
  // returns '' so callers can prompt the user to set a name and retry.
  // (Native window.prompt() is blocked inside cross-origin iframes such as
  // ArcGIS Experience Builder, so we drive an in-app modal instead.)
  const ensureReviewer = (): string => {
    if (reviewer) return reviewer;
    setReviewerModalOpen(true);
    return '';
  };
  const promptReviewer = () => setReviewerModalOpen(true);
  const applyReviewer = (name: string) => {
    setReviewer(name);
    saveReviewer(name);
    setReviewerModalOpen(false);
  };

  const saveValidation = (oid: number, rec: ValidationRecord) => {
    setValidations((prev) => {
      const next = { ...prev, [oid]: rec };
      saveValidations(next);
      return next;
    });
    showToast('✓', 'Validation saved');
  };

  // A sandboxed iframe swallows downloads silently, so embedded reviewers get
  // the copy-out panel instead of a download that could never fire.
  const deliver = (filename: string, data: string, mime: string) => {
    if (isEmbedded()) {
      setExportPayload({ filename, data });
      return;
    }
    download(filename, data, mime);
    showToast('⬇', 'Export downloaded');
  };

  const exportCsv = () => {
    const rows: string[][] = [[
      'OBJECTID', 'UPI', 'sector', 'district', 'predicted_code', 'predicted_use',
      'match_ground', 'corrected_code', 'corrected_use', 'lon', 'lat',
      'reviewer', 'timestamp',
    ]];
    Object.entries(validations).forEach(([oid, v]) =>
      rows.push([
        oid, v.upi || '', v.sector || '', v.district || '', v.predicted || '', v.predictedUse || '',
        v.match || '', v.corrected || '', v.corrected ? LABELS[v.corrected] || v.corrected : '',
        // 7 decimals ≈ 1 cm; enough to plot the centroid as an XY table.
        typeof v.lon === 'number' ? v.lon.toFixed(7) : '',
        typeof v.lat === 'number' ? v.lat.toFixed(7) : '',
        v.reviewer || '', new Date(v.ts).toISOString(),
      ]),
    );
    if (rows.length === 1) { showToast('!', 'No validations to export yet'); return; }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    deliver('sparc_validations_' + stamp() + '.csv', csv, 'text/csv;charset=utf-8');
  };
  // Exported as GeoJSON so the data team can load it straight into ArcGIS/QGIS.
  // Records saved before centroids were stored have no lon/lat, so their
  // geometry is null — valid GeoJSON, and the OBJECTID still joins back to the
  // source layer.
  const exportJson = () => {
    if (!Object.keys(validations).length) { showToast('!', 'No validations to export yet'); return; }
    const fc = {
      type: 'FeatureCollection',
      features: Object.entries(validations).map(([oid, v]) => ({
        type: 'Feature',
        geometry:
          typeof v.lon === 'number' && typeof v.lat === 'number'
            ? { type: 'Point', coordinates: [v.lon, v.lat] }
            : null,
        properties: {
          OBJECTID: Number(oid),
          UPI: v.upi || '',
          sector: v.sector || '',
          district: v.district || '',
          predicted_code: v.predicted || '',
          predicted_use: v.predictedUse || '',
          match_ground: v.match || '',
          corrected_code: v.corrected || '',
          corrected_use: v.corrected ? LABELS[v.corrected] || v.corrected : '',
          reviewer: v.reviewer || '',
          timestamp: new Date(v.ts).toISOString(),
        },
      })),
    };
    deliver(
      'sparc_validations_' + stamp() + '.geojson',
      JSON.stringify(fc, null, 2),
      'application/geo+json',
    );
  };
  // window.confirm() is suppressed in cross-origin iframes and returns false
  // there, which silently swallowed the clear — use the in-app modal instead.
  const clearAll = () => {
    const n = Object.keys(validations).length;
    if (!n) { showToast('!', 'Nothing to clear'); return; }
    setConfirmClear(true);
  };
  const doClearAll = () => {
    setValidations({});
    saveValidations({});
    setConfirmClear(false);
    showToast('✓', 'Cleared');
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
        onCoordsCopied={(text, ok) =>
          ok ? showToast('📋', text + ' copied') : showToast('!', 'Clipboard blocked here')
        }
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

      {reviewerModalOpen && (
        <ReviewerModal
          current={reviewer}
          onSave={applyReviewer}
          onClose={() => setReviewerModalOpen(false)}
        />
      )}

      {exportPayload && (
        <ExportModal
          filename={exportPayload.filename}
          data={exportPayload.data}
          onClose={() => setExportPayload(null)}
        />
      )}

      {confirmClear && (
        <ConfirmModal
          title="Clear all validations?"
          body={`This removes all ${Object.keys(validations).length} decisions stored on this device. Export them first if you need them — this cannot be undone.`}
          confirmLabel="Clear all"
          onConfirm={doClearAll}
          onClose={() => setConfirmClear(false)}
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
