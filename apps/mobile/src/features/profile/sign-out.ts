import { ActionSheetIOS, Alert, Platform } from "react-native";
import { pendingTotal, signOutWarning, type PendingSummary } from "../../lib/outbox/pending";
import { t } from "../../lib/i18n";

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
      { title, message, options: [t("mobileApp.signOut.sendThemFirst"), t("mobileApp.signOut.signOutAnyway"), t("mobileApp.common.cancel")], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (index) => {
        if (index === 0) actions.sendFirst();
        if (index === 1) actions.signOut();
      },
    );
    return;
  }
  Alert.alert(title, message, [
    { text: t("mobileApp.common.cancel"), style: "cancel" },
    { text: t("mobileApp.signOut.sendFirst"), onPress: actions.sendFirst },
    { text: t("mobileApp.signOut.signOut"), style: "destructive", onPress: actions.signOut },
  ]);
}
