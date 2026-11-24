import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";
import { useTabHeaderOptions } from "../../../src/components/header-items";
import { LogExpenseButton } from "../../../src/components/log-expense-button";
import { androidHeaderOptions } from "../../../src/lib/android-header";
import { useT } from "../../../src/lib/i18n";

/** An expense opened from Search or a notification still has the list under it. */
export const unstable_settings = { initialRouteName: "index" };

/** The Expenses tab's own native stack: a large title on iOS, the avatar on the right (D-197). */
export default function ExpensesLayout() {
  const t = useT();
  const colors = useNativeColors();
  const tabHeader = useTabHeaderOptions(t("mobileApp.tabs.expenses"), Platform.OS, Platform.OS === "ios" ? { right: [<LogExpenseButton key="add" />] } : {});
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.onSurface,
        headerTitleStyle: { color: colors.onSurface },
        headerBackButtonDisplayMode: "minimal",
        ...androidHeaderOptions(colors),
      }}
    >
      <Stack.Screen name="index" options={tabHeader} />
      <Stack.Screen name="[id]" options={{ title: t("mobileApp.expense.title") }} />
    </Stack>
  );
}
