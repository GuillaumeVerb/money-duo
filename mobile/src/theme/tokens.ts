import { Platform, StyleSheet } from 'react-native';

export const hairline = StyleSheet.hairlineWidth;

/**
 * Design system — passe premium : légèreté, finesse, hiérarchie douce.
 */
export const colors = {
  primary: '#2A5F5F',
  primaryMuted: '#3D7A7A',
  primarySoft: '#EEF5F4',
  primaryDark: '#1F4747',

  accentWarm: '#C4836D',
  accentSand: '#D4A574',
  sandSoft: '#F5EBE3',

  /** Fond légèrement plus aéré */
  canvas: '#F9F7F4',
  surface: '#FFFFFF',
  surfaceMuted: '#FAFAF8',
  surfaceElevated: '#FDFCFA',
  overlay: 'rgba(44, 36, 28, 0.035)',

  text: '#2C2825',
  textSecondary: '#736C67',
  textMuted: '#9C9590',
  textInverse: '#FDFCFA',

  border: '#EAE6E0',
  borderLight: '#F2EFE9',
  /** Liste groupée type iOS */
  groupBorder: 'rgba(44, 36, 28, 0.08)',

  success: '#4A8F7A',
  successSoft: '#EDF6F3',
  warning: '#C9A227',
  warningSoft: '#FBF6E4',
  danger: '#C45C5C',
  dangerSoft: '#FCEEED',
  info: '#5A8FA3',
  infoSoft: '#EAF3F7',

  accent: '#2A5F5F',
  neutralWarm: '#F9F7F4',
  neutralText: '#2C2825',
  neutralMuted: '#736C67',
  alertSoft: '#C4836D',
} as const;

export const spacing = {
  xxs: 2,
  xs: 5,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
} as const;

export const radius = {
  xs: 8,
  sm: 11,
  md: 13,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const fontSize = {
  hero: 32,
  /** Titres d’écran principaux — légerement sous le hero pour moins d’effet « brutal » */
  display: 24,
  title: 20,
  titleSm: 17,
  body: 15,
  small: 13,
  caption: 12,
  micro: 11,
} as const;

/** Hiérarchie typo : éviter le gras systématique */
export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
};

export const lineHeight = {
  tight: 1.2,
  body: 1.45,
  relaxed: 1.55,
} as const;

export const shadow = {
  /** Presque plat — léger relief seulement */
  card: Platform.select({
    ios: {
      shadowColor: '#2C2825',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 10,
    },
    android: { elevation: 1 },
    default: {},
  }),
  tabBar: Platform.select({
    ios: {
      shadowColor: '#2C2825',
      shadowOffset: { width: 0, height: -1 },
      shadowOpacity: 0.03,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {},
  }),
  soft: Platform.select({
    ios: {
      shadowColor: '#2C2825',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
    },
    android: { elevation: 1 },
    default: {},
  }),
} as const;
