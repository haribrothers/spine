import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { Select, Switch } from "@spine/ui-native";

const CURRENCY_OPTIONS = [
  { label: "USD", value: "usd" },
  { label: "EUR", value: "eur" },
  { label: "GBP", value: "gbp" },
];

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between border-b border-border px-4 py-3.5 dark:border-border-dark">
      <Text className="text-[15px] text-on-surface dark:text-on-surface-dark">{label}</Text>
      {children}
    </View>
  );
}

/** Settings template — the Profile-tab shape: grouped rows with native Switch/Select controls. */
export default function SettingsTemplateScreen() {
  const [notifications, setNotifications] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [currency, setCurrency] = useState("usd");

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="py-4">
        <Text className="px-4 pb-2 text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">
          Notifications
        </Text>
        <View className="rounded-lg border border-border bg-surface mx-4 dark:border-border-dark dark:bg-surface-dark">
          <SettingsRow label="Payment updates">
            <Switch value={notifications} onValueChange={setNotifications} />
          </SettingsRow>
          <SettingsRow label="Marketing emails">
            <Switch value={marketing} onValueChange={setMarketing} />
          </SettingsRow>
        </View>

        <Text className="px-4 pb-2 pt-6 text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">
          Regional
        </Text>
        <View className="rounded-lg border border-border bg-surface mx-4 dark:border-border-dark dark:bg-surface-dark">
          <SettingsRow label="Currency">
            <Select options={CURRENCY_OPTIONS} value={currency} onValueChange={setCurrency} />
          </SettingsRow>
        </View>
      </ScrollView>
    </>
  );
}
