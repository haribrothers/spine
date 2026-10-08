import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useCameraPermissions } from "expo-camera";
import Camera from "lucide-react-native/icons/camera";
import CloudOff from "lucide-react-native/icons/cloud-off";
import Images from "lucide-react-native/icons/images";
import ReceiptText from "lucide-react-native/icons/receipt-text";
import X from "lucide-react-native/icons/x";
import { FullWidthButton, Spinner, useNativeColors } from "@spine/ui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const CAMERA_TITLE = "Allow camera access";
export const CAMERA_MESSAGE = "Spine uses the camera for site photos and receipt pictures. Photos go only to your company's Spine server — never anywhere else.";
export const CAMERA_REASONS = ["Progress photos tagged to the job", "Receipts attached to your expenses", "Works with no signal — uploads later"];
export const SETTINGS_HINT = { ios: "Said no before? Turn it on in Settings › Spine › Camera.", android: "Said no before? Turn it on in Settings › Apps › Spine › Permissions." };

/**
 * US-MOB-14 · `MobCameraPermission` (and Android) — before the system asks,
 * why Spine wants the camera, with three reasons. "Continue" asks; once
 * refused for good, it opens Settings and says where to turn it on. "Not
 * now" goes back. The camera shows only once it's allowed.
 */
export function CameraPermissionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const colors = useNativeColors();
  const [permission, request] = useCameraPermissions();
  const insets = useSafeAreaInsets();

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <Spinner />
      </View>
    );
  }
  if (permission.granted) return <>{children}</>;

  const refused = permission.status === "denied";
  const icons = [Images, ReceiptText, CloudOff];
  return (
    <ScrollView
      testID="camera-permission"
      contentInsetAdjustmentBehavior="never"
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerClassName="flex-grow gap-6 px-6"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }}
    >
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} className="h-11 w-11 items-center justify-center rounded-full bg-surface dark:bg-surface-dark">
        <X size={22} color={colors.onSurface} />
      </Pressable>
      <View className="gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-info-bg dark:bg-info-bg-dark">
          <Camera size={30} color={colors.primary} />
        </View>
        <Text accessibilityRole="header" className="text-[28px] font-bold text-on-surface dark:text-on-surface-dark">{CAMERA_TITLE}</Text>
        <Text className="text-[16px] text-on-surface-muted dark:text-on-surface-muted-dark">{CAMERA_MESSAGE}</Text>
      </View>
      <View className="gap-3">
        {CAMERA_REASONS.map((reason, i) => {
          const Icon = icons[i]!;
          return (
            <View key={reason} className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-draft-bg dark:bg-draft-bg-dark">
                <Icon size={20} color={colors.onSurfaceMuted} />
              </View>
              <Text className="flex-1 text-[16px] text-on-surface dark:text-on-surface-dark">{reason}</Text>
            </View>
          );
        })}
      </View>
      <View className="flex-1" />
      <View className="gap-2">
        <FullWidthButton
          testID="camera-permission-continue"
          label={refused && !permission.canAskAgain ? "Open Settings" : "Continue"}
          onPress={() => {
            if (!permission.canAskAgain) void Linking.openSettings();
            else void request();
          }}
        />
        <Pressable testID="camera-permission-not-now" onPress={() => router.back()} accessibilityRole="button" className="min-h-[48px] items-center justify-center">
          <Text className="text-[16px] font-semibold text-primary dark:text-primary-dark">Not now</Text>
        </Pressable>
        <Text testID="camera-permission-hint" className="text-center text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
          {Platform.OS === "android" ? SETTINGS_HINT.android : SETTINGS_HINT.ios}
        </Text>
      </View>
    </ScrollView>
  );
}
