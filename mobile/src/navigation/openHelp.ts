type StackLikeParent = {
  navigate: (name: 'Help') => void;
};

type TabNavigation = {
  getParent: () => StackLikeParent | undefined;
};

/** Ouvre l’écran d’aide depuis un onglet (navigateur racine). */
export function openHelp (tabScreenNavigation: TabNavigation) {
  const parent = tabScreenNavigation.getParent() as StackLikeParent | undefined;
  parent?.navigate('Help');
}
