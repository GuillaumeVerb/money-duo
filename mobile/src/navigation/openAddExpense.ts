type StackLikeParent = {
  navigate: (name: 'AddExpense', params?: { expenseId?: string }) => void;
};

type TabNavigation = {
  getParent: () => StackLikeParent | undefined;
};

/** Ouvre le modal depuis un écran d’onglet (parent = stack racine). */
export function openAddExpense (
  tabScreenNavigation: TabNavigation,
  expenseId?: string
) {
  const parent = tabScreenNavigation.getParent() as StackLikeParent | undefined;
  if (!parent) {
    return;
  }
  if (expenseId) {
    parent.navigate ('AddExpense', { expenseId });
  } else {
    parent.navigate ('AddExpense');
  }
}
