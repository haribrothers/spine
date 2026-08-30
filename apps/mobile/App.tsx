import "./global.css";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@spine/ui-native";
import { RootNavigator } from "./src/navigation/root-navigator";
import { secureStoreThemeStorage } from "./src/lib/theme-storage";

export default function App() {
  return (
    <ThemeProvider storage={secureStoreThemeStorage}>
      <SafeAreaProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
