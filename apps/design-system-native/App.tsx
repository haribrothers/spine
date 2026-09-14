import "./global.css";
import { SpineUIProvider } from "@spine/ui-native";
import { RootNavigator } from "./src/navigation/root-navigator";
import { DesktopShell } from "./src/components/desktop-shell";
import { persistentThemeStorage } from "./src/lib/theme-storage";
import { useIsDesktopLayout } from "./src/lib/use-is-desktop-layout";

function Root() {
  const isDesktopLayout = useIsDesktopLayout();
  return isDesktopLayout ? <DesktopShell /> : <RootNavigator />;
}

export default function App() {
  return (
    <SpineUIProvider storage={persistentThemeStorage}>
      <Root />
    </SpineUIProvider>
  );
}
