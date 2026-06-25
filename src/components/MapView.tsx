import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl';
import { CONFIG } from '../config';
import { COLORS, DATE_COLORS, ORDER, STATUS_COLORS } from '../constants';
import { CITY_BBOX, SECTOR_BBOX } from '../sectors';
import { loadViewport } from '../featureService';
import type { BFeature, Basemap, Mode, Validations } from '../types';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const EMPTY = { type: 'FeatureCollection', features: [] } as const;
const BASE_LAYERS = ['sat', 'ref', 'streets', 'dark'] as const;
const BASES: Record<Basemap, string[]> = {
  sat: ['sat'],
  hybrid: ['sat', 'ref'],
  streets: ['streets'],
  dark: ['dark'],
};

interface Props {
  mode: Mode;
  basemap: Basemap;
  sectorFilter: string;
  activeUse: string[];
  activeYear: string[];
  activeStatus: string[];
  validations: Validations;
  onBasemap: (b: Basemap) => void;
  onSelect: (f: BFeature, clientX: number, clientY: number) => void;
  onViewportFeatures: (features: BFeature[], capped: boolean, zoomedIn: boolean) => void;
}

const BASEMAP_LABELS: [Basemap, string][] = [
  ['sat', 'World Imagery'],
  ['hybrid', 'Hybrid'],
  ['streets', 'Streets'],
  ['dark', 'Dark'],
];

function tagFeature(f: BFeature, validations: Validations): BFeature {
  const v = validations[f.properties.OBJECTID];
  f.properties._v = !!v;
  f.properties._vs = v
    ? v.match === 'Yes'
      ? 'match'
      : 'mismatch'
    : f.properties.match_ground === 'Yes'
      ? 'match'
      : 'none';
  return f;
}

export default function MapView(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const loadedRef = useRef(false);
  const featuresRef = useRef<BFeature[]>([]);
  const seqRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [hint, setHint] = useState<string | null>('Zoom in to load individual buildings');
  const [loadText, setLoadText] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  /* -------- colour + filter expressions (read latest props) ------------- */
  const useColorExpr = (): any => {
    const m: any[] = ['match', ['get', 'lu_cod_pred']];
    ORDER.forEach((c) => m.push(c, COLORS[c]));
    m.push('#888');
    return m;
  };
  const colorExpr = (): any => {
    const mode = propsRef.current.mode;
    if (mode === 'use') return useColorExpr();
    if (mode === 'status')
      return ['match', ['get', '_vs'], 'match', STATUS_COLORS.match, 'mismatch', STATUS_COLORS.mismatch, STATUS_COLORS.none];
    return ['match', ['get', 'acquisition_date'], '2023', DATE_COLORS['2023'], '2025', DATE_COLORS['2025'], '#888'];
  };
  const pointFilter = (): any => {
    const { mode, activeUse, activeYear, activeStatus } = propsRef.current;
    if (mode === 'use') return ['in', ['get', 'lu_cod_pred'], ['literal', activeUse]];
    if (mode === 'year') return ['in', ['get', 'acquisition_date'], ['literal', activeYear]];
    return ['in', ['get', '_vs'], ['literal', activeStatus]];
  };
  const applyPaint = () => {
    const map = mapRef.current;
    if (!map || !map.getLayer('pts')) return;
    map.setPaintProperty('pts', 'circle-color', colorExpr());
    map.setFilter('pts', pointFilter());
    map.setFilter('pts-val', ['all', pointFilter(), ['get', '_v']] as any);
  };

  /* -------- viewport loading -------------------------------------------- */
  const loadVP = async () => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getZoom() < CONFIG.pointZoom) {
      setHint('Zoom in to load individual buildings');
      setLoadText(null);
      (map.getSource('pts') as GeoJSONSource | undefined)?.setData(EMPTY as any);
      featuresRef.current = [];
      propsRef.current.onViewportFeatures([], false, false);
      return;
    }
    const seq = ++seqRef.current;
    setHint('Loading buildings…');
    const b = map.getBounds();
    const res = await loadViewport(
      { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() },
      () => seq !== seqRef.current,
    );
    if (seq !== seqRef.current) return;
    const tagged = res.features.map((f) => tagFeature(f, propsRef.current.validations));
    featuresRef.current = tagged;
    (map.getSource('pts') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: tagged,
    } as any);
    applyPaint();
    setHint(null);
    setLoadText(
      `${tagged.length.toLocaleString()} buildings in view${res.capped ? ' · zoom in for full detail' : ''}`,
    );
    propsRef.current.onViewportFeatures(tagged, res.capped, true);
  };
  const scheduleLoad = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(loadVP, 260);
  };

  /* -------- init map (once) -------------------------------------------- */
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      attributionControl: false,
      center: [(CITY_BBOX[0] + CITY_BBOX[2]) / 2, (CITY_BBOX[1] + CITY_BBOX[3]) / 2],
      zoom: 11,
      maxZoom: 19,
      style: {
        version: 8,
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
        sources: {
          sat: { type: 'raster', tiles: [ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Esri World Imagery' },
          ref: { type: 'raster', tiles: [ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19 },
          streets: { type: 'raster', tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'], tileSize: 256 },
          dark: { type: 'raster', tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'], tileSize: 256 },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#070b0f' } },
          { id: 'sat', type: 'raster', source: 'sat' },
          { id: 'ref', type: 'raster', source: 'ref', layout: { visibility: 'none' } },
          { id: 'streets', type: 'raster', source: 'streets', layout: { visibility: 'none' } },
          { id: 'dark', type: 'raster', source: 'dark', layout: { visibility: 'none' } },
        ],
      },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: 'SPARC pilot · Esri World Imagery' }),
      'bottom-left',
    );

    map.on('load', () => {
      // admin boundaries — dashed outlines + sector labels
      map.addSource('bounds', { type: 'geojson', data: `${import.meta.env.BASE_URL}boundaries.geojson` });
      map.addLayer({
        id: 'bounds-ln',
        type: 'line',
        source: 'bounds',
        paint: { 'line-color': '#dfe7ee', 'line-width': 1.1, 'line-opacity': 0.55, 'line-dasharray': [3, 2] },
      });
      map.addLayer({
        id: 'bounds-lbl',
        type: 'symbol',
        source: 'bounds',
        layout: {
          'symbol-placement': 'point',
          'text-field': ['get', 's'],
          'text-font': ['Open Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 13, 15, 16, 20],
          'text-padding': 6,
          'text-allow-overlap': false,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.05,
        },
        paint: { 'text-color': '#f2f6fa', 'text-halo-color': '#0a0e12', 'text-halo-width': 1.8, 'text-opacity': 0.92 },
      });

      // building points
      map.addSource('pts', { type: 'geojson', data: EMPTY as any });
      map.addLayer({
        id: 'pts',
        type: 'circle',
        source: 'pts',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.2, 15, 3.6, 17, 6, 19, 11],
          'circle-color': useColorExpr(),
          'circle-opacity': 0.92,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 14, 0.4, 17, 1.1],
          'circle-stroke-color': 'rgba(0,0,0,.55)',
        },
      });
      map.addLayer({
        id: 'pts-val',
        type: 'circle',
        source: 'pts',
        filter: ['all', pointFilter(), ['get', '_v']] as any,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 4, 15, 6.5, 17, 10, 19, 16],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.9,
        },
      });

      map.on('click', 'pts', (e) => {
        const f = e.features && (e.features[0] as unknown as BFeature);
        if (!f) return;
        const oe = e.originalEvent as MouseEvent;
        propsRef.current.onSelect(f, oe.clientX, oe.clientY);
      });
      map.on('mouseenter', 'pts', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'pts', () => (map.getCanvas().style.cursor = ''));
      map.on('moveend', scheduleLoad);
      map.on('zoomend', scheduleLoad);

      loadedRef.current = true;
      applyPaint();
      scheduleLoad();
      setTimeout(() => setBooting(false), 500);
    });

    return () => {
      window.clearTimeout(timerRef.current);
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------- react to UI state changes ---------------------------------- */
  useEffect(() => {
    if (loadedRef.current) applyPaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode, props.activeUse, props.activeYear, props.activeStatus]);

  useEffect(() => {
    if (!loadedRef.current) return;
    const map = mapRef.current!;
    featuresRef.current.forEach((f) => tagFeature(f, props.validations));
    (map.getSource('pts') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: featuresRef.current,
    } as any);
    applyPaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.validations]);

  useEffect(() => {
    if (!loadedRef.current) return;
    const map = mapRef.current!;
    if (props.sectorFilter === 'ALL') {
      map.fitBounds([[CITY_BBOX[0], CITY_BBOX[1]], [CITY_BBOX[2], CITY_BBOX[3]]], { padding: 30, duration: 900 });
    } else {
      const b = SECTOR_BBOX[props.sectorFilter];
      if (b) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 900 });
    }
  }, [props.sectorFilter]);

  useEffect(() => {
    if (!loadedRef.current) return;
    const map = mapRef.current!;
    const want = BASES[props.basemap];
    BASE_LAYERS.forEach((l) => map.setLayoutProperty(l, 'visibility', want.includes(l) ? 'visible' : 'none'));
  }, [props.basemap]);

  return (
    <div id="map" ref={containerRef}>
      <div className="basebar">
        {BASEMAP_LABELS.map(([key, label]) => (
          <button
            key={key}
            className={props.basemap === key ? 'on' : ''}
            onClick={() => props.onBasemap(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {hint && (
        <div className="zoomhint" style={{ display: 'flex' }}>
          <span className="s" />
          <span>{hint}</span>
        </div>
      )}
      {loadText && <div className="loadcount" dangerouslySetInnerHTML={{ __html: loadText.replace(/^(\d[\d,]*)/, '<b>$1</b>') }} />}
      {booting && (
        <div id="veil">
          <div className="spin" />
          <div className="t">Connecting to feature service…</div>
        </div>
      )}
    </div>
  );
}
