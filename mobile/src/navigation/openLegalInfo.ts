type StackLikeParent = {
  navigate: (name: 'LegalInfo', params: { document: 'privacy' | 'terms' }) => void;
};

type TabNavigation = {
  getParent: () => StackLikeParent | undefined;
};

export function openLegalInfo (
  tabScreenNavigation: TabNavigation,
  document: 'privacy' | 'terms'
) {
  const parent = tabScreenNavigation.getParent() as StackLikeParent | undefined;
  parent?.navigate('LegalInfo', { document });
}
