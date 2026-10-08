import { Text, View } from "react-native";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CloudUpload from "lucide-react-native/icons/cloud-upload";
import { useNativeColors } from "@spine/ui-native";
import { pendingTotal, usePendingSummary } from "../lib/outbox/pending";

/** US-MOB-03 — "All synced" in the header, or "<n> waiting" while the outbox has items. */
export function SyncPill() {
  const colors = useNativeColors();
  const waiting = pendingTotal(usePendingSummary());
  const label = waiting === 0 ? "All synced" : `${waiting} waiting`;
  return (
    <View
      testID="sync-pill"
      accessible
      accessibilityLabel={waiting === 0 ? "All synced" : `${waiting} waiting to sync`}
      className={`h-9 flex-row items-center gap-1.5 rounded-full px-3 ${waiting === 0 ? "bg-paid-bg dark:bg-paid-bg-dark" : "bg-due-soon-bg dark:bg-due-soon-bg-dark"}`}
    >
      {waiting === 0 ? <CircleCheck size={16} color={colors.paid} /> : <CloudUpload size={16} color={colors.dueSoon} />}
      <Text className={`text-[14px] font-semibold ${waiting === 0 ? "text-paid dark:text-paid-dark" : "text-due-soon dark:text-due-soon-dark"}`}>{label}</Text>
    </View>
  );
}
