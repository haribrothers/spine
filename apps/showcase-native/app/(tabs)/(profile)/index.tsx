import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Avatar, Button, Select, Switch, useTheme, type ThemePreference } from "@spine/ui-native";

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

/** Real Profile tab — a settings-shaped screen exercising the app's own theme toggle plus a couple of native controls. */
export default function ProfileScreen() {
  const { preference, setPreference } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [currency, setCurrency] = useState("usd");

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="py-4">
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
  );
}
