import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import Plus from "lucide-react-native/icons/plus";
import { useNativeColors } from "@spine/ui-native";
import { useT } from "../lib/i18n";

/** US-MOB-12 — the "+" beside the avatar on Expenses (iOS); Android has the floating "Log expense". */
export function LogExpenseButton() {
  const t = useT();
  const router = useRouter();
  const colors = useNativeColors();
  return (
    <Pressable testID="expenses-add" onPress={() => router.push("/expense-new")} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("mobileApp.logExpense.label")} className="h-11 w-11 items-center justify-center">
      <Plus size={24} color={colors.onSurface} />
    </Pressable>
  );
}
