export type SplitRuleKind = 'equal' | 'custom_percent' | 'proportional_income';
export type ExpenseType = 'shared' | 'personal' | 'child' | 'home';

export type Household = {
  id: string;
  name: string;
  currency: string;
  default_split_rule: SplitRuleKind;
  default_custom_percent: number | null;
  /** Plafond optionnel pour le total des dépenses du mois civil. */
  monthly_budget_cap?: number | null;
  /** Notes communes (contrat léger / alignement couple). */
  charter_notes?: string | null;
};

export type HouseholdMember = {
  id: string;
  household_id: string;
  user_id: string;
  role: 'owner' | 'member';
  monthly_income: number | null;
  display_name: string | null;
};

export type Category = {
  id: string;
  household_id: string;
  name: string;
  parent_id: string | null;
};

/** Plafond mensuel pour une catégorie (comparé aux dépenses du mois civil). */
export type CategoryBudget = {
  id: string;
  household_id: string;
  category_id: string;
  monthly_cap: number;
};

export type Expense = {
  id: string;
  household_id: string;
  amount: number;
  spent_at: string;
  payer_member_id: string;
  /** Membre qui a enregistré la ligne (après migration produit). */
  created_by_member_id?: string | null;
  /** Lien optionnel (ticket, preuve hébergée ailleurs). */
  attachment_url?: string | null;
  category_id?: string | null;
  expense_type: ExpenseType;
  split_rule_snapshot: SplitRuleKind;
  split_custom_percent_snapshot: number | null;
  note: string | null;
  /** Mot laissé par l’autre membre (couple). */
  partner_note?: string | null;
  partner_note_by_member_id?: string | null;
};

export type DecisionNote = {
  id: string;
  household_id: string;
  month: string;
  body: string;
  remind_at?: string | null;
  created_at: string;
};

export type Settlement = {
  id: string;
  household_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  settled_at: string;
  note: string | null;
};

export type Goal = {
  id: string;
  household_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  status?: 'future' | 'in_progress' | 'paused' | 'done' | 'archived';
  project_type?: 'shared' | 'household' | 'child' | 'personal_visible';
  priority?: 'high' | 'medium' | 'low';
  horizon?: 'this_month' | 'this_quarter' | 'this_year' | 'later' | null;
  next_step?: string | null;
  why_it_matters?: string | null;
  focus_on_home?: boolean;
  estimated_amount?: number | null;
  note?: string | null;
  links?: string[] | null;
  /** Si défini, objectif archivé (hors vue principale). */
  archived_at?: string | null;
};

export type GoalContribution = {
  id: string;
  goal_id: string;
  household_id: string;
  amount: number;
  contributed_at: string;
  note: string | null;
  member_id?: string | null;
};

export type RecurringTemplate = {
  id: string;
  household_id: string;
  label: string;
  amount: number;
  category_id: string | null;
  payer_member_id: string | null;
  expense_type: ExpenseType;
  cadence: 'weekly' | 'monthly' | 'yearly';
  next_occurrence: string;
};
