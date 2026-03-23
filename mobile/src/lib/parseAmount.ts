/** Interprète une saisie utilisateur (virgule ou point). */
export function parseAmount (raw: string): number | null {
  const n = Number (raw.replace (',', '.').trim ());
  if (!Number.isFinite (n)) {
    return null;
  }
  return n;
}
