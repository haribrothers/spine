import "./global.css";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@spine/ui-native";
import { RootNavigator } from "./src/navigation/root-navigator";
import { DesktopShell } from "./src/components/desktop-shell";
import { inMemoryThemeStorage } from "./src/lib/theme-storage";
import { useIsDesktopLayout } from "./src/lib/use-is-desktop-layout";

function Root() {
  const isDesktopLayout = useIsDesktopLayout();
  return isDesktopLayout ? <DesktopShell /> : <RootNavigator />;
}

export default function App() {
  return (
    <ThemeProvider storage={inMemoryThemeStorage}>
      <SafeAreaProvider>
        <Root />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
