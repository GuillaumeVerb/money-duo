/**
 * UX §14 : 1 accent, 1 neutre chaud, 1 alerte douce — sobre.
 */
export const colors = {
  accent: '#2D6A6A',
  neutralWarm: '#F4F1EC',
  neutralText: '#2C2C2C',
  neutralMuted: '#6B6B6B',
  surface: '#FFFFFF',
  border: '#E0D9D0',
  alertSoft: '#C97B63',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const fontSize = {
  title: 22,
  body: 16,
  small: 14,
  caption: 12,
} as const;
