function toYMDLocal (d: Date): string {
  const y = d.getFullYear ();
  const m = String (d.getMonth () + 1).padStart (2, '0');
  const day = String (d.getDate ()).padStart (2, '0');
  return `${y}-${m}-${day}`;
}

/** Bornes du mois civil local, au format YYYY-MM-DD (champ `spent_at`). */
export function monthBoundsISO (ref: Date = new Date ()): {
  start: string;
  end: string;
} {
  const start = new Date (ref.getFullYear (), ref.getMonth (), 1);
  const end = new Date (ref.getFullYear (), ref.getMonth () + 1, 0);
  return {
    start: toYMDLocal (start),
    end: toYMDLocal (end),
  };
}

export function isDateInRangeInclusive (
  ymd: string,
  start: string,
  end: string
): boolean {
  return ymd >= start && ymd <= end;
}
