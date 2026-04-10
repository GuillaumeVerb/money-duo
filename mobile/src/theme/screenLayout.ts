import { spacing } from './tokens';

/** Marge horizontale commune aux écrans principaux (scroll / listes). */
export const screenPaddingH = spacing.lg;

/** Espacement vertical entre sections principales (titres → cartes, blocs). */
export const sectionGap = spacing.lg;

/** Espacement sous la safe area supérieure (onglets sans header natif). */
export function screenContentPaddingTop (safeTop: number): number {
  return safeTop + spacing.md;
}
