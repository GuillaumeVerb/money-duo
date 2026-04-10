type StackLikeParent = {
  navigate: (name: 'DecisionMemoHistory') => void;
};

type TabNavigation = {
  getParent: () => StackLikeParent | undefined;
};

export function openDecisionMemoHistory (tabScreenNavigation: TabNavigation) {
  const parent = tabScreenNavigation.getParent() as StackLikeParent | undefined;
  parent?.navigate('DecisionMemoHistory');
}
