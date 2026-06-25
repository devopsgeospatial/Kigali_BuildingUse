import { CONFIG, OUT_FIELDS } from './config';
import type { BFeature, CityStats } from './types';

type QueryParams = Record<string, string | number>;
const Q = (params: QueryParams) =>
  CONFIG.layer + '/query?' + new URLSearchParams(params as Record<string, string>).toString();

const COUNT_STAT = JSON.stringify([
  { statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'n' },
]);

async function getJson(url: string): Promise<any> {
  const r = await fetch(url);
  return r.json();
}

/** Citywide / per-sector statistics computed server-side (no bulk download). */
export async function loadOverview(where = '1=1'): Promise<CityStats> {
  const groupBy = async (field: string) => {
    const j = await getJson(
      Q({ where, f: 'json', returnGeometry: 'false', groupByFieldsForStatistics: field, outStatistics: COUNT_STAT }),
    );
    return (j.features || []) as { attributes: Record<string, any> }[];
  };
  const count = async (w: string) =>
    ((await getJson(Q({ where: w, returnCountOnly: 'true', f: 'json' }))).count as number) || 0;

  const [total, byUseRaw, byYearRaw, ground, withH] = await Promise.all([
    count(where),
    groupBy('lu_cod_pred'),
    groupBy('acquisition_date'),
    count(`${where} AND match_ground='Yes'`),
    count(`${where} AND Height IS NOT NULL`),
  ]);

  const byUse: Record<string, number> = {};
  byUseRaw.forEach((f) => (byUse[f.attributes.lu_cod_pred] = f.attributes.n));
  const byYear: Record<string, number> = {};
  byYearRaw.forEach((f) => (byYear[f.attributes.acquisition_date] = f.attributes.n));

  return { total, ground, withH, byUse, byYear };
}

export interface Bounds {
  w: number;
  s: number;
  e: number;
  n: number;
}
export interface ViewportResult {
  features: BFeature[];
  capped: boolean;
}

/**
 * Paged viewport query. `isStale` lets the caller abandon a load that has been
 * superseded by a newer map movement.
 */
export async function loadViewport(b: Bounds, isStale?: () => boolean): Promise<ViewportResult> {
  const env = [b.w, b.s, b.e, b.n].join(',');
  let offset = 0;
  let all: BFeature[] = [];
  let more = true;
  let capped = false;

  while (more && all.length < CONFIG.maxFeatures) {
    const url = Q({
      where: '1=1',
      geometry: env,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: OUT_FIELDS,
      outSR: '4326',
      f: 'geojson',
      resultRecordCount: CONFIG.pageSize,
      resultOffset: offset,
      returnExceededLimitFeatures: 'true',
    });
    const j = await getJson(url);
    if (isStale && isStale()) return { features: [], capped: false };
    if (!j.features) break;
    all = all.concat(j.features as BFeature[]);
    more = (j.properties && j.properties.exceededTransferLimit) || j.exceededTransferLimit;
    offset += CONFIG.pageSize;
    if (all.length >= CONFIG.maxFeatures) {
      capped = true;
      break;
    }
  }
  return { features: all, capped };
}
