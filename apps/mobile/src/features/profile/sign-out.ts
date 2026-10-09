import { ActionSheetIOS, Alert, Platform } from "react-native";
import { pendingTotal, signOutWarning, type PendingSummary } from "../../lib/outbox/pending";

/**
 * US-MOB-02 · `MobSignOutConfirm` — signing out with items still waiting
 * warns first, safe choice first. iOS: a confirmation dialog with "Send
 * them first", "Sign out anyway" (destructive) and "Cancel"; Android: a
 * Material alert with "Cancel", "Send first" and "Sign out". With nothing
 * waiting it signs straight out.
 */
export function confirmSignOut(summary: PendingSummary, actions: { signOut: () => void; sendFirst: () => void }): void {
  if (pendingTotal(summary) === 0) {
    actions.signOut();
    return;
  }
  const { title, message } = signOutWarning(summary);
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, message, options: ["Send them first", "Sign out anyway", "Cancel"], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (index) => {
        if (index === 0) actions.sendFirst();
        if (index === 1) actions.signOut();
      },
    );
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Send first", onPress: actions.sendFirst },
    { text: "Sign out", style: "destructive", onPress: actions.signOut },
  ]);
}
