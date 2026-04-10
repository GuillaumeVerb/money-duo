type StackLikeParent = {
  navigate: (name: 'RecurringCharges') => void;
};

type TabNavigation = {
  getParent: () => StackLikeParent | undefined;
};

/** Ouvre la gestion des charges récurrentes depuis un onglet. */
export function openRecurringCharges (tabScreenNavigation: TabNavigation) {
  const parent = tabScreenNavigation.getParent() as StackLikeParent | undefined;
  parent?.navigate('RecurringCharges');
}
