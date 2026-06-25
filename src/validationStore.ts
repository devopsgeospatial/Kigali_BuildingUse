import type { Validations } from './types';

const STORE_KEY = 'sparc_validations_v1';
const NAME_KEY = 'sparc_reviewer';

export function loadValidations(): Validations {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveValidations(v: Validations): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(v));
}

export function loadReviewer(): string {
  return localStorage.getItem(NAME_KEY) || '';
}

export function saveReviewer(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}
