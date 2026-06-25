/* ----------------------------------------------------------------------------
 * Runtime configuration for the Kigali Building Use app.
 * Validation decisions are kept in the browser (localStorage) and exported to
 * CSV/JSON for the data team — by design. The service is read-only here.
 * -------------------------------------------------------------------------- */
export const CONFIG = {
  layer:
    'https://services7.arcgis.com/htgaiKX6RV2DDGgK/arcgis/rest/services/Kigali_Building_Use__Parcels_Zoning/FeatureServer/0',
  pointZoom: 14, // below this zoom: show boundaries only, not individual points
  pageSize: 2000, // service maxRecordCount
  maxFeatures: 12000, // safety cap per viewport load
} as const;

export const OUT_FIELDS = [
  'OBJECTID',
  'UPI',
  'sector',
  'district',
  'province',
  'score',
  'Height',
  'estimated_floor',
  'area',
  'acquisition_date',
  'lu_cod_pred',
  'Predicted_Use',
  'Proposed_Use',
  'Registered_Use',
  'match_ground',
  'Parcel_Match',
].join(',');
