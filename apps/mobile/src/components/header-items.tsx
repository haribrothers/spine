import { Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@spine/ui-native";
import { useSignedInSession } from "../lib/session/session-provider";
import { initials } from "../lib/member-display";

/** The avatar at the top right of every tab; opens Profile (D-197, the showcase-native pattern). */
export function ProfileAvatarButton() {
  const router = useRouter();
  const { member } = useSignedInSession();
  return (
    <Pressable onPress={() => router.push("/profile")} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Profile, ${member.name}`}>
      <Avatar fallback={initials(member)} size="lg" />
    </Pressable>
  );
}

/**
 * Native-stack header options for a top-level tab: a large title on iOS and
 * the avatar on the right. iOS takes it as a custom header item (no shared
 * glass background, like showcase-native's avatar); Android as `headerRight`.
 */
export function useTabHeaderOptions(title: string, os: typeof Platform.OS = Platform.OS) {
  if (os === "ios") {
    return {
      title,
      headerLargeTitleEnabled: true,
      unstable_headerRightItems: () => [{ type: "custom" as const, hidesSharedBackground: true, element: <ProfileAvatarButton /> }],
    };
  }
  return { title, headerRight: () => <ProfileAvatarButton /> };
}
