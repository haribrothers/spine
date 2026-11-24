import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CloudUpload from "lucide-react-native/icons/cloud-upload";
import { useNativeColors } from "@spine/ui-native";
import { pendingItems, useOutboxItems } from "../lib/outbox/pending";
import { useT } from "../lib/i18n";

/**
 * US-MOB-03, US-MOB-08 — "All synced" in the header, or "<n> waiting to
 * sync" in the due-soon colour while the outbox has items (those needing
 * fixing included). Opens Sync.
 */
export function SyncPill() {
  const t = useT();
  const router = useRouter();
  const colors = useNativeColors();
  const waiting = pendingItems(useOutboxItems());
  const label = waiting === 0 ? t("mobileApp.syncPill.allSynced") : t("mobileApp.syncPill.waiting", { n: waiting });
  return (
    <Pressable
      testID="sync-pill"
      onPress={() => router.push("/sync")}
      accessibilityRole="button"
      accessibilityLabel={t("mobileApp.syncPill.label", { label })}
      hitSlop={6}
      className={`h-9 flex-row items-center gap-1.5 rounded-full px-3 active:opacity-70 ${waiting === 0 ? "bg-paid-bg dark:bg-paid-bg-dark" : "bg-due-soon-bg dark:bg-due-soon-bg-dark"}`}
    >
      {waiting === 0 ? <CircleCheck size={16} color={colors.paid} /> : <CloudUpload size={16} color={colors.dueSoon} />}
      <Text className={`text-[14px] font-semibold ${waiting === 0 ? "text-paid dark:text-paid-dark" : "text-due-soon dark:text-due-soon-dark"}`}>{label}</Text>
    </Pressable>
  );
}
