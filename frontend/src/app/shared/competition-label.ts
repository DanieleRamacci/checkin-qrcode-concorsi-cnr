const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prefer the public competition title; an internal commission id is not a title. */
export function competitionLabel(title?: string | null, commissionId?: string | null): string {
  const value = title?.trim() ?? '';
  if (!value || UUID.test(value) || value === commissionId || value === `Concorso ${commissionId}`) {
    return 'Concorso';
  }
  return /^\d+(?:\.\d+)*$/.test(value) ? `Concorso ${value}` : value;
}
