import { Text, View } from "react-native";
import CloudUpload from "lucide-react-native/icons/cloud-upload";
import { useNativeColors } from "@spine/ui-native";

/** A grey "waiting" chip with the upload cloud: "2 photos waiting", "Completion waiting" (US-MOB-07). */
export function WaitingChip({ label, testID }: { label: string; testID?: string }) {
  const colors = useNativeColors();
  return (
    <View testID={testID} accessible accessibilityLabel={label} className="flex-row items-center gap-1.5 self-start rounded-full bg-draft-bg px-2.5 py-0.5 dark:bg-draft-bg-dark">
      <CloudUpload size={14} color={colors.onSurfaceMuted} />
      <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{label}</Text>
    </View>
  );
}
