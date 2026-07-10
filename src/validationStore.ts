import type { Validations } from './types';

const STORE_KEY = 'sparc_validations_v1';
const NAME_KEY = 'sparc_reviewer';

/**
 * localStorage is often unavailable or throws inside cross-origin iframes
 * (e.g. when this app is embedded in ArcGIS Experience Builder), because
 * browsers partition or block third-party storage. Fall back to an in-memory
 * store so the app keeps working for the session instead of crashing.
 */
const memory: Record<string, string> = {};

function safeGet(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v : (key in memory ? memory[key] : null);
  } catch {
    return key in memory ? memory[key] : null;
  }
}

function safeSet(key: string, value: string): void {
  memory[key] = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked in this context — in-memory copy already kept */
  }
}

export function loadValidations(): Validations {
  try {
    return JSON.parse(safeGet(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveValidations(v: Validations): void {
  safeSet(STORE_KEY, JSON.stringify(v));
}

export function loadReviewer(): string {
  return safeGet(NAME_KEY) || '';
}

export function saveReviewer(name: string): void {
  safeSet(NAME_KEY, name);
}
