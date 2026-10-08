import { FlatList, Modal, Platform, Pressable, Text, View } from "react-native";
import Check from "lucide-react-native/icons/check";
import { useNativeColors } from "@spine/ui-native";

export interface PickerOption {
  value: string;
  label: string;
  detail?: string | null;
}

/**
 * A list to choose one thing from (the camera's job pill): a page sheet on
 * iOS, a full-height sheet on Android, with the current choice ticked.
 */
export function PickerSheet({ visible, title, options, value, onPick, onClose, testID }: { visible: boolean; title: string; options: PickerOption[]; value: string | null; onPick: (value: string) => void; onClose: () => void; testID?: string }) {
  const colors = useNativeColors();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined} onRequestClose={onClose}>
      <View testID={testID} className="flex-1 bg-background dark:bg-background-dark">
        <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
          <Text accessibilityRole="header" className="text-[20px] font-semibold text-on-surface dark:text-on-surface-dark">{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10} className="min-h-[44px] justify-center">
            <Text className="text-[16px] font-semibold text-primary dark:text-primary-dark">Cancel</Text>
          </Pressable>
        </View>
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          data={options}
          keyExtractor={(option) => option.value}
          contentContainerClassName="px-4 pb-10"
          renderItem={({ item, index }) => (
            <Pressable
              testID={`picker-option-${item.value}`}
              onPress={() => {
                onPick(item.value);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: item.value === value }}
              className={`min-h-[52px] flex-row items-center gap-3 bg-surface px-4 py-3 dark:bg-surface-dark ${index === 0 ? "rounded-t-2xl" : "border-t border-border dark:border-border-dark"} ${index === options.length - 1 ? "rounded-b-2xl" : ""}`}
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-[16px] text-on-surface dark:text-on-surface-dark">{item.label}</Text>
                {item.detail ? <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{item.detail}</Text> : null}
              </View>
              {item.value === value ? <Check size={20} color={colors.primary} /> : null}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}
