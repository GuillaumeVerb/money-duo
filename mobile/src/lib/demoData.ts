import type {
  Category,
  CategoryBudget,
  Goal,
  Household,
  HouseholdMember,
} from './types';

/** Identifiant utilisateur fictif (session démo). */
export const DEMO_USER_ID = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeee0001';

const HID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbb001';

export const demoHousehold: Household = {
  id: HID,
  name: 'Notre foyer (démo)',
  currency: 'EUR',
  default_split_rule: 'equal',
  default_custom_percent: null,
  monthly_budget_cap: 3200,
  charter_notes:
    'Les gros achats on en parle avant. Chacun garde une petite enveloppe perso sans justifier.',
};

export const demoMembers: HouseholdMember[] = [
  {
    id: 'mem-demo-1',
    household_id: HID,
    user_id: DEMO_USER_ID,
    role: 'owner',
    monthly_income: 3200,
    display_name: 'Alex',
  },
  {
    id: 'mem-demo-2',
    household_id: HID,
    user_id: 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeee0002',
    role: 'member',
    monthly_income: 2800,
    display_name: 'Sam',
  },
];

export const demoCategories: Category[] = [
  { id: 'cat-d1', household_id: HID, name: 'Courses', parent_id: null },
  { id: 'cat-d2', household_id: HID, name: 'Loyer', parent_id: null },
  { id: 'cat-d3', household_id: HID, name: 'Loisirs', parent_id: null },
  { id: 'cat-d4', household_id: HID, name: 'Santé', parent_id: null },
  { id: 'cat-d5', household_id: HID, name: 'Autre', parent_id: null },
];

export const demoCategoryBudgets: CategoryBudget[] = [
  {
    id: 'bud-d1',
    household_id: HID,
    category_id: 'cat-d1',
    monthly_cap: 500,
  },
];

/** Données cockpit pour l’aperçu (aucune persistance). */
export const demoGoal: Goal = {
  id: 'goal-demo-1',
  household_id: HID,
  name: 'Vacances été',
  target_amount: 2400,
  current_amount: 1180,
  target_date: '2026-08-15',
};

export const demoHomeCockpit = {
  /** Repère mensuel indicatif (pas encore un champ produit) */
  monthlyGuide: 2800,
  spent: 1640,
  owedAbs: 84,
  /** positif : membre 1 reçoit */
  owedSign: 1 as -1 | 0 | 1,
  topCategories: [
    { name: 'Courses', total: 420 },
    { name: 'Loyer', total: 0 },
    { name: 'Loisirs', total: 180 },
  ],
  recentExpenses: [
    { label: 'Courses hebdo', amount: 86, cat: 'Courses', day: '18' },
    { label: 'Restaurant', amount: 64, cat: 'Loisirs', day: '16' },
    { label: 'Pharmacie', amount: 34, cat: 'Santé', day: '14' },
  ],
  splitPct: [52, 48] as [number, number],
  nextCharge: {
    label: 'Abonnement énergie',
    amount: 95,
    next: '2026-03-24',
  },
  insight: 'Mois sous contrôle — vous gardez de la marge avant le repère.',
  monthStatus: 'ok' as 'ok' | 'watch' | 'tight',
};
