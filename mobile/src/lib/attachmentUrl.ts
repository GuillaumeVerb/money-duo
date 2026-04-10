/** Accepte http(s) ou www. — renvoie une URL utilisable par Linking. */
export function normalizeOptionalHttpUrl (raw: string): string | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }
  if (/^https?:\/\//i.test(t)) {
    return t;
  }
  if (/^www\./i.test(t)) {
    return `https://${t}`;
  }
  return null;
}
