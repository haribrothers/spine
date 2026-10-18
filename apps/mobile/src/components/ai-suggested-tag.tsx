import { Text, View } from "react-native";
import Sparkles from "lucide-react-native/icons/sparkles";
import { useNativeColors } from "@spine/ui-native";

/**
 * The shared rules (21-ai.md, D-242) — "Suggested by AI" on a field AI
 * filled in, until the person changes it: the icon and the words, never
 * colour alone. The web's is `apps/web/src/components/ai-suggested-tag.tsx`.
 */
export function AiSuggestedTag({ className = "" }: { className?: string }) {
  const colors = useNativeColors();
  return (
    <View testID="ai-suggested" pointerEvents="none" accessible accessibilityLabel="Suggested by AI" className={`flex-row items-center gap-1 rounded-full bg-info-bg px-2 py-0.5 dark:bg-info-bg-dark ${className}`}>
      <Sparkles size={12} color={colors.primary} />
      <Text className="text-[12px] font-medium text-primary dark:text-primary-dark">Suggested by AI</Text>
    </View>
  );
}
