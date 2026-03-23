export type SplitRuleKind = 'equal' | 'custom_percent' | 'proportional_income';
export type ExpenseType = 'shared' | 'personal' | 'child' | 'home';

export type Household = {
  id: string;
  name: string;
  currency: string;
  default_split_rule: SplitRuleKind;
  default_custom_percent: number | null;
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

export type Expense = {
  id: string;
  household_id: string;
  amount: number;
  spent_at: string;
  payer_member_id: string;
  category_id?: string | null;
  expense_type: ExpenseType;
  split_rule_snapshot: SplitRuleKind;
  split_custom_percent_snapshot: number | null;
  note: string | null;
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
};

export type RecurringTemplate = {
  id: string;
  household_id: string;
  label: string;
  amount: number;
  category_id: string | null;
  payer_member_id: string | null;
  expense_type: ExpenseType;
  cadence: 'monthly';
  next_occurrence: string;
};
