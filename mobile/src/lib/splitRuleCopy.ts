import type { Household, SplitRuleKind } from './types';

export function splitRuleLabel (
  rule: SplitRuleKind,
  household: Pick<Household, 'default_custom_percent'>
): string {
  switch (rule) {
    case 'equal':
      return 'Partage à parts égales (50/50)';
    case 'custom_percent': {
      const p = household.default_custom_percent ?? 50;
      const q = Math.round((100 - p) * 10) / 10;
      return `Partage personnalisé (${p}% / ${q}%)`;
    }
    case 'proportional_income':
      return 'Proportionnel aux revenus déclarés';
    default:
      return 'Règle du foyer';
  }
}

export function splitRuleShort (rule: SplitRuleKind): string {
  switch (rule) {
    case 'equal':
      return '50/50';
    case 'custom_percent':
      return 'Personnalisé';
    case 'proportional_income':
      return 'Proportionnel';
    default:
      return '—';
  }
}
