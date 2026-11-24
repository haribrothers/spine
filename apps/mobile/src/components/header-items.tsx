import { Platform, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@spine/ui-native";
import { useSignedInSession } from "../lib/session/session-provider";
import { initials } from "../lib/member-display";
import { useT } from "../lib/i18n";

/** The avatar at the top right of every tab; opens Profile (D-197, the showcase-native pattern). */
export function ProfileAvatarButton() {
  const t = useT();
  const router = useRouter();
  const { member } = useSignedInSession();
  return (
    <Pressable onPress={() => router.push("/profile")} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("mobileApp.profileAvatar.label", { name: member.name })}>
      <Avatar fallback={initials(member)} size="lg" />
    </Pressable>
  );
}

/**
 * Native-stack header options for a top-level tab: a large title on iOS and
 * the avatar on the right. iOS takes them as custom header items (no shared
 * glass background, like showcase-native's avatar); Android as
 * `headerRight` in one row. Today adds the sync pill on the left and the
 * bell before the avatar (US-MOB-03): `left` goes before the title on iOS
 * and leads the right-hand row on Android, as drawn.
 */
export function useTabHeaderOptions(title: string, os: typeof Platform.OS = Platform.OS, extra: { left?: React.ReactElement; right?: React.ReactElement[] } = {}) {
  const right = [...(extra.right ?? []), <ProfileAvatarButton key="avatar" />];
  if (os === "ios") {
    return {
      title,
      headerLargeTitleEnabled: true,
      ...(extra.left ? { unstable_headerLeftItems: () => [{ type: "custom" as const, hidesSharedBackground: true, element: extra.left! }] } : {}),
      unstable_headerRightItems: () => right.map((element) => ({ type: "custom" as const, hidesSharedBackground: true, element })),
    };
  }
  return {
    title,
    headerRight: () => (
      <View className="flex-row items-center gap-2">
        {extra.left}
        {right}
      </View>
    ),
  };
}
