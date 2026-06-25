/* Land-use classes, colours and display labels.
 * "Residential — Unplanned/Planned" intentionally softens the raw model labels
 * for a government audience; raw code stays available in the data. */
export const LABELS: Record<string, string> = {
  RI: 'Residential — Unplanned',
  ROR: 'Residential — Planned',
  RAP: 'Residential — Apartment',
  CM: 'Commercial',
  CMI: 'Mixed Use',
  PI: 'Public Institution',
  I: 'Industrial',
};

export const COLORS: Record<string, string> = {
  RI: '#7FB77E',
  ROR: '#4CAF50',
  RAP: '#1B5E20',
  CM: '#FFC107',
  CMI: '#FF7043',
  PI: '#5B9BD5',
  I: '#BA68C8',
};

export const ORDER = ['CM', 'CMI', 'RAP', 'ROR', 'RI', 'PI', 'I'];

export const DATE_COLORS: Record<string, string> = { '2023': '#4F8FBF', '2025': '#F5A623' };
export const YEAR_ORDER = ['2025', '2023'];

export const STATUS_COLORS = { match: '#4CAF50', mismatch: '#EF5350', none: '#7d8fa0' };
export const STATUS_ORDER: ('match' | 'mismatch' | 'none')[] = ['match', 'mismatch', 'none'];
export const STATUS_LABELS = {
  match: 'Matches / confirmed',
  mismatch: 'Mismatch',
  none: 'Not yet reviewed',
};
