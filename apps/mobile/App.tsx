import "./global.css";
import { SpineUIProvider } from "@spine/ui-native";
import { RootNavigator } from "./src/navigation/root-navigator";
import { secureStoreThemeStorage } from "./src/lib/theme-storage";

export default function App() {
  return (
    <SpineUIProvider storage={secureStoreThemeStorage}>
      <RootNavigator />
    </SpineUIProvider>
  );
}
