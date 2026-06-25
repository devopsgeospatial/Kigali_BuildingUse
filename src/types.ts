export type Mode = 'use' | 'status' | 'year';
export type Basemap = 'sat' | 'hybrid' | 'streets' | 'dark';
export type ValidationStatus = 'match' | 'mismatch' | 'none';

export interface BuildingProps {
  OBJECTID: number;
  UPI?: string;
  sector?: string;
  district?: string;
  province?: string;
  score?: number | null;
  Height?: number | null;
  estimated_floor?: number | null;
  area?: number | null;
  acquisition_date?: string;
  lu_cod_pred?: string;
  Predicted_Use?: string;
  Proposed_Use?: string;
  Registered_Use?: string;
  match_ground?: string | null;
  Parcel_Match?: string;
  /** injected client-side: has a local validation */
  _v?: boolean;
  /** injected client-side: validation status for colouring */
  _vs?: ValidationStatus;
}

export interface BFeature {
  type: 'Feature';
  id?: number;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: BuildingProps;
}

export interface ValidationRecord {
  match: 'Yes' | 'No';
  corrected: string;
  upi?: string;
  sector?: string;
  district?: string;
  predicted?: string;
  predictedUse?: string;
  reviewer: string;
  ts: number;
}

export type Validations = Record<number, ValidationRecord>;

export interface CityStats {
  total: number;
  ground: number;
  withH: number;
  byUse: Record<string, number>;
  byYear: Record<string, number>;
}

export interface Sector {
  s: string; // sector name
  d: string; // district
  bb: [number, number, number, number]; // bbox [w,s,e,n]
}
