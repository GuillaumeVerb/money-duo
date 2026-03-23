export type Expense = {
  amount: number;
  payer_member_id: string;
};

export type ExpenseSplitRow = {
  member_id: string;
  amount_due: number;
};

export type Settlement = {
  from_member_id: string;
  to_member_id: string;
  amount: number;
};
