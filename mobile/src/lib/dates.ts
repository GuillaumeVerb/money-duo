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

/** Titre lisible pour un mois civil local, ex. « mars 2026 ». */
export function formatMonthHeading (ref: Date = new Date ()): string {
  const raw = ref.toLocaleDateString ('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
  return raw.charAt (0).toUpperCase () + raw.slice (1);
}

/** Affiche une date `YYYY-MM-DD` ou ISO en libellé court local. */
export function formatISODateFr (iso: string): string {
  const ymd = iso.slice (0, 10);
  const d = new Date (ymd + 'T12:00:00');
  if (Number.isNaN (d.getTime ())) {
    return iso;
  }
  return d.toLocaleDateString ('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Interprète `YYYY-MM-JJ` en date locale midi (évite décalage fuseau). */
export function parseYMDToLocalDate (ymd: string): Date {
  const s = ymd.trim().slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function toYMDLocalFromDate (d: Date): string {
  return toYMDLocal(d);
}

/** Clé `YYYY-MM` pour navigation entre écrans. */
export function monthKeyFromDate (ref: Date): string {
  const y = ref.getFullYear();
  const m = String(ref.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function parseMonthKeyToDate (key: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key.trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) {
    return null;
  }
  return new Date(y, mo - 1, 1, 12, 0, 0, 0);
}
