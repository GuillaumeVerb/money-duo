type StackLikeParent = {
  navigate: (
    name: 'MonthlyRecap',
    params?: { initialMonthKey?: string }
  ) => void;
};

type TabNavigation = {
  getParent: () => StackLikeParent | undefined;
};

/** Ouvre l’écran récap mensuel depuis un onglet. */
export function openMonthlyRecap (
  tabScreenNavigation: TabNavigation,
  initialMonthKey?: string
) {
  const parent = tabScreenNavigation.getParent() as StackLikeParent | undefined;
  if (initialMonthKey) {
    parent?.navigate('MonthlyRecap', { initialMonthKey });
  } else {
    parent?.navigate('MonthlyRecap');
  }
}

type StackNav = {
  navigate: (
    name: 'MonthHistory' | 'FinancialCharter' | 'LightSimulator'
  ) => void;
};

/** Historique des mois (liste → récap). */
export function openMonthHistory (tabScreenNavigation: TabNavigation) {
  const parent = tabScreenNavigation.getParent() as StackNav | undefined;
  parent?.navigate('MonthHistory');
}

export function openFinancialCharter (tabScreenNavigation: TabNavigation) {
  const parent = tabScreenNavigation.getParent() as StackNav | undefined;
  parent?.navigate('FinancialCharter');
}

export function openLightSimulator (tabScreenNavigation: TabNavigation) {
  const parent = tabScreenNavigation.getParent() as StackNav | undefined;
  parent?.navigate('LightSimulator');
}
