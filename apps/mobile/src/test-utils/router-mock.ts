export const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() };
/** The options the screen last passed to `<Stack.Screen options>` (header items, titles). */
export const mockScreen: { options: Record<string, unknown> } = { options: {} };

jest.mock("expo-router", () => {
  const mockReact = jest.requireActual("react");
  function Screen({ options }: { options?: Record<string, unknown> }) {
    mockScreen.options = options ?? {};
    return null;
  }
  return {
    useRouter: () => mockRouter,
    useFocusEffect: (effect: () => void | (() => void)) => mockReact.useEffect(effect, [effect]),
    useLocalSearchParams: () => ({}),
    // Screens that set options after mount record them like <Stack.Screen options>.
    useNavigation: () => ({
      setOptions: (options: Record<string, unknown>) => {
        mockScreen.options = options;
      },
      getParent: () => undefined,
      canGoBack: () => false,
    }),
    Stack: { Screen },
  };
});
