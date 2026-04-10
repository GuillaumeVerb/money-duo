type StackLikeParent = {
  navigate: (name: 'ExpenseDetail', params: { expenseId: string }) => void;
};

type TabNavigation = {
  getParent: () => StackLikeParent | undefined;
};

/** Ouvre le détail d’une dépense depuis un onglet (parent = stack racine). */
export function openExpenseDetail (
  tabScreenNavigation: TabNavigation,
  expenseId: string
) {
  const parent = tabScreenNavigation.getParent() as StackLikeParent | undefined;
  if (!parent) {
    return;
  }
  parent.navigate('ExpenseDetail', { expenseId });
}
