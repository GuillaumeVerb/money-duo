import type { Household, SplitRuleKind } from './types';

export type RuleOverride = SplitRuleKind | 'default';

export function resolveSplitSnapshot (
  household: Household,
  ruleOverride: RuleOverride,
  customPctInput: string
): { split_rule_snapshot: SplitRuleKind; split_custom_percent_snapshot: number | null } {
  const snapRule: SplitRuleKind =
    ruleOverride === 'default' ? household.default_split_rule : ruleOverride;
  let snapPct: number | null = null;
  if (snapRule === 'custom_percent') {
    snapPct =
      ruleOverride === 'custom_percent'
        ? Number (customPctInput)
        : Number (household.default_custom_percent ?? customPctInput);
  }
  return {
    split_rule_snapshot: snapRule,
    split_custom_percent_snapshot: snapPct,
  };
}

/** Compare à la règle foyer pour préremplir le formulaire (édition). */
export function isSameAsHouseholdDefault (
  household: Household,
  ruleSnapshot: SplitRuleKind,
  customSnapshot: number | null | undefined
): boolean {
  if (ruleSnapshot !== household.default_split_rule) {
    return false;
  }
  if (ruleSnapshot !== 'custom_percent') {
    return true;
  }
  return (
    Number (customSnapshot ?? NaN) === Number (household.default_custom_percent ?? NaN)
  );
}
