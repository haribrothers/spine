import { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import XIcon from "lucide-react-native/icons/x";
import { Avatar, Button, Select, Switch, useNativeColors, useTheme, type ThemePreference } from "@spine/ui-native";
import { useProfileSheet } from "../lib/profile-sheet-context";

const CURRENCY_OPTIONS = [
  { label: "USD", value: "usd" },
  { label: "EUR", value: "eur" },
  { label: "GBP", value: "gbp" },
];

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between border-b border-border px-4 py-3.5 dark:border-border-dark">
      <Text className="text-[15px] text-on-surface dark:text-on-surface-dark">{label}</Text>
      {children}
    </View>
  );
}

/**
 * `<Modal>`, not a routed screen — see `profile-sheet-context.tsx`'s own
 * doc comment for the full rationale (a real, severe, unfixable-in-routing
 * bug this sidesteps entirely). Rendered once at the app root
 * (`app/_layout.tsx`), visibility controlled by `useProfileSheet()`.
 *
 * `presentationStyle="formSheet"` is iOS-only (per RN's own `ModalPropsIOS`
 * type) and renders identically to the previous routed version — confirmed
 * with the user, both are thin wrappers around the same real
 * `UIModalPresentationFormSheet`. Android has no such native concept for
 * plain `Modal` (unlike `react-native-screens`' `Stack.Screen`, which
 * documents a real "falls back to modal stackPresentation" behavior) — so
 * Android gets `animationType="slide"` with the header's own Done button as
 * the close affordance, matching the full-screen slide-up look already
 * confirmed working before this change (`presentationStyle` itself is
 * simply ignored on Android, per RN's own type).
 *
 * Since this is no longer a native-stack screen, it has no automatic
 * header — the title bar (title + close button) is hand-built here,
 * mirroring the previous `Stack.Screen options.headerRight`/`title`
 * exactly: a bare "X" icon on iOS (per Apple HIG for a sheet with no
 * unsaved-changes context), "Done" text on Android (this app's existing
 * Material convention, no bare-icon-only dismiss convention on Android the
 * way iOS has one).
 *
 * The header row is wrapped in `SafeAreaView edges={["top"]}` — a real,
 * device-confirmed bug otherwise: without it, "Done"/the close button sat
 * flush against Android's status bar, wrapped onto two lines, and
 * overlapped the status bar icons (the previous routed version got this
 * for free from `react-native-screens`' own native-stack header, which
 * this hand-built one has to replicate explicitly). `edges={["top"]}` only
 * (not the default all-edges) since the bottom edge is `formSheet`-only
 * concern on iOS where this modal doesn't fill the screen, and Android's
 * own bottom nav-bar inset isn't relevant to a full-screen slide-up sheet
 * with no bottom-anchored content of its own.
 */
export function ProfileSheet() {
  const { isOpen, close } = useProfileSheet();
  const colors = useNativeColors();
  const { preference, setPreference } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [currency, setCurrency] = useState("usd");

  return (
    <Modal
      visible={isOpen}
      presentationStyle={Platform.OS === "ios" ? "formSheet" : undefined}
      animationType="slide"
      onRequestClose={close}
    >
      <View className="flex-1 bg-background dark:bg-background-dark">
        <SafeAreaView edges={["top"]} className="border-b border-border bg-background dark:border-border-dark dark:bg-background-dark">
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="w-14" />
            <Text className="text-[17px] font-semibold text-on-surface dark:text-on-surface-dark">Profile</Text>
            <Pressable onPress={close} hitSlop={8} className="w-14 items-end">
              {Platform.OS === "ios" ? (
                <View className="h-8 w-8 items-center justify-center rounded-full bg-surface-sunken dark:bg-surface-sunken-dark">
                  <XIcon size={18} color={colors.onSurfaceMuted} />
                </View>
              ) : (
                <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>
                  Done
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>

        <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1" contentContainerClassName="py-4">
          <View className="flex-row items-center gap-3 px-4 pb-6">
            <Avatar fallback="SP" size="lg" />
            <View>
              <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">Spine Showcase</Text>
              <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Design system reference</Text>
            </View>
          </View>

          <Text className="px-4 pb-2 text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">
            Preferences
          </Text>
          <View className="mx-4 rounded-lg border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
            <SettingsRow label="Theme">
              <Select options={THEME_OPTIONS} value={preference} onValueChange={setPreference} />
            </SettingsRow>
            <SettingsRow label="Currency">
              <Select options={CURRENCY_OPTIONS} value={currency} onValueChange={setCurrency} />
            </SettingsRow>
            <SettingsRow label="Notifications">
              <Switch value={notifications} onValueChange={setNotifications} />
            </SettingsRow>
          </View>

          <View className="px-4 pt-6">
            <Button variant="secondary" onPress={() => {}}>
              Sign out
            </Button>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
