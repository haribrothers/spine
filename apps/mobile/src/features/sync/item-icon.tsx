import { View } from "react-native";
import Check from "lucide-react-native/icons/check";
import Flag from "lucide-react-native/icons/flag";
import Images from "lucide-react-native/icons/images";
import ReceiptText from "lucide-react-native/icons/receipt-text";
import { useNativeColors } from "@spine/ui-native";
import type { ItemIcon } from "../../lib/outbox/describe";

/** The tile beside an outbox item: grey while waiting, red when it needs fixing, green with a tick once sent. */
export function OutboxItemIcon({ icon, state }: { icon: ItemIcon; state: "waiting" | "failed" | "sent" }) {
  const colors = useNativeColors();
  const box = state === "failed" ? "bg-overdue-bg dark:bg-overdue-bg-dark" : state === "sent" ? "bg-paid-bg dark:bg-paid-bg-dark" : "bg-draft-bg dark:bg-draft-bg-dark";
  const color = state === "failed" ? colors.overdue : state === "sent" ? colors.paid : colors.onSurfaceMuted;
  const Icon = state === "sent" ? Check : icon === "photos" ? Images : icon === "expense" ? ReceiptText : Flag;
  return (
    <View className={`h-11 w-11 items-center justify-center rounded-xl ${box}`}>
      <Icon size={20} color={color} />
    </View>
  );
}
