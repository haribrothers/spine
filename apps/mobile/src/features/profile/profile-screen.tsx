import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import CircleCheck from "lucide-react-native/icons/circle-check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import CloudUpload from "lucide-react-native/icons/cloud-upload";
import LogOut from "lucide-react-native/icons/log-out";
import Mail from "lucide-react-native/icons/mail";
import Server from "lucide-react-native/icons/server";
import { Avatar, FormRow, FormSection, FullWidthButton, SegmentedControl, useNativeColors, useTheme, type ThemePreference } from "@spine/ui-native";
import { useSession, useSignedInSession } from "../../lib/session/session-provider";
import { lastSentAt, pendingItems, useOutboxItems, usePendingSummary } from "../../lib/outbox/pending";
import { SectionHeader } from "../../components/section-header";
import { initials, roleLine } from "../../lib/member-display";
import { versionLine } from "../../lib/app-version";
import { confirmSignOut } from "./sign-out";
import { t as translate, useT, formatLocale } from "../../lib/i18n";

const APPEARANCE: { label: string; value: ThemePreference }[] = [
  { label: translate("mobileApp.profile.system"), value: "system" },
  { label: translate("mobileApp.profile.light"), value: "light" },
  { label: translate("mobileApp.profile.dark"), value: "dark" },
];

export const FIELD_NOTE = translate("mobileApp.profile.fieldNote");

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <FormRow label={label} last={last}>
      <Text numberOfLines={1} className="text-[15px] text-on-surface dark:text-on-surface-dark">
        {value}
      </Text>
    </FormRow>
  );
}

/**
 * Profile's screen options: on iOS a form sheet with the stack's own header
 * and a Close header item (the sheet's content then insets under it); on
 * Android a page with the top app bar's back arrow.
 */
export function profileScreenOptions(os: typeof Platform.OS, colors: { background: string }, onClose: () => void) {
  if (os === "ios") {
    return {
      presentation: "formSheet" as const,
      sheetAllowedDetents: [1],
      sheetGrabberVisible: true,
      headerShown: true,
      title: translate("mobileApp.profile.title"),
      unstable_headerRightItems: () => [
        { type: "button" as const, label: translate("mobileApp.common.close"), icon: { type: "sfSymbol" as const, name: "xmark" as const }, accessibilityLabel: translate("mobileApp.common.close"), onPress: onClose },
      ],
    };
  }
  return { headerShown: true, title: translate("mobileApp.profile.title"), headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false };
}

/**
 * US-MOB-02 · `MobProfile` / `MobProfileAndroid` — opened from the avatar on
 * every tab: a form sheet on iOS, a page on Android (D-197). Name, role and
 * business, email, server, appearance, sync, the Field note, and Sign out
 * (which warns when items are still waiting to sync).
 */
export function ProfileScreen() {
  const t = useT();
  const router = useRouter();
  const colors = useNativeColors();
  const { signOut } = useSession();
  const session = useSignedInSession();
  const pending = usePendingSummary();
  const { preference, setPreference } = useTheme();
  const { member } = session;

  const items = useOutboxItems();
  const waiting = pendingItems(items);
  const selected = APPEARANCE.find((option) => option.value === preference)?.label ?? t("mobileApp.profile.system");
  const syncLabel = waiting === 0 ? t("mobileApp.syncPill.allSynced") : t("mobileApp.syncPill.waiting", { n: waiting });
  const sentAt = lastSentAt(items);
  const signOutPress = () =>
    confirmSignOut(pending, {
      signOut: () => void signOut(),
      // US-MOB-02/08: "Send them first" opens Sync.
      sendFirst: () => router.push("/sync"),
    });
  const appearance = (
    <SegmentedControl
      values={APPEARANCE.map((option) => option.label)}
      value={selected}
      onValueChange={(label) => {
        const option = APPEARANCE.find((candidate) => candidate.label === label);
        if (option) setPreference(option.value);
      }}
      testID="profile-appearance"
    />
  );
  const version = (
    <Text className="text-center text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">
      {versionLine()}
    </Text>
  );

  if (Platform.OS === "android") {
    // US-MOB-20 · `MobProfileAndroid`: a Material list — the avatar beside the name, two-line rows with leading icons, an outlined Sign out.
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="gap-5 pb-10 pt-2">
        <View className="flex-row items-center gap-4 px-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-container dark:bg-primary-container-dark">
            <Text className="text-[22px] font-semibold text-on-primary-container dark:text-on-primary-container-dark">{initials(member)}</Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-[24px] text-on-surface dark:text-on-surface-dark">{member.name}</Text>
            <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{roleLine(member)}</Text>
          </View>
        </View>
        <View>
          {[
            { icon: Mail, value: member.email, label: t("mobileApp.signIn.email") },
            { icon: Server, value: session.server.replace(/^https?:\/\//, ""), label: t("mobileApp.signIn.server") },
          ].map(({ icon: Icon, value, label }) => (
            <View key={label} accessible accessibilityLabel={t("mobileApp.profile.infoLabel", { label, value })} className="min-h-[64px] flex-row items-center gap-4 px-4 py-2">
              <Icon size={22} color={colors.onSurfaceMuted} />
              <View className="flex-1">
                <Text numberOfLines={1} className="text-[16px] text-on-surface dark:text-on-surface-dark">{value}</Text>
                <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{label}</Text>
              </View>
            </View>
          ))}
          <Pressable testID="profile-sync" onPress={() => router.push("/sync")} accessibilityRole="button" accessibilityLabel={t("mobileApp.syncPill.label", { label: syncLabel })} className="min-h-[64px] flex-row items-center gap-4 px-4 py-2">
            {waiting === 0 ? <CircleCheck size={22} color={colors.paid} /> : <CloudUpload size={22} color={colors.dueSoon} />}
            <View className="flex-1">
              <Text className="text-[16px] text-on-surface dark:text-on-surface-dark">{syncLabel}</Text>
              {sentAt ? (
                <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
                  {t("mobileApp.profile.lastSent", { time: new Date(sentAt).toLocaleTimeString(formatLocale(), { hour: "numeric", minute: "2-digit" }) })}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={20} color={colors.onSurfaceMuted} />
          </Pressable>
        </View>
        <View className="gap-3 px-4">
          <SectionHeader title={t("mobileApp.profile.appearance")} />
          {appearance}
        </View>
        {member.role === "field" ? <Text className="px-5 text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{FIELD_NOTE}</Text> : null}
        <View className="px-4">
          <Pressable
            testID="profile-sign-out"
            onPress={signOutPress}
            accessibilityRole="button"
            className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-full border border-border-strong dark:border-border-strong-dark"
          >
            <LogOut size={18} color={colors.overdue} />
            <Text className="text-[16px] font-semibold text-overdue dark:text-overdue-dark">{t("mobileApp.signOut.signOut")}</Text>
          </Pressable>
        </View>
        {version}
      </ScrollView>
    );
  }

  return (
    // The ScrollView is the screen's root: an iOS form sheet sizes its content
    // from a direct ScrollView child (react-native-screens) and collapses a wrapper.
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerClassName="gap-6 px-4 pb-10 pt-4"
    >
      <View className="items-center gap-2">
        <Avatar fallback={initials(member)} size="lg" className="h-16 w-16" />
        <Text className="text-[20px] font-semibold text-on-surface dark:text-on-surface-dark">{member.name}</Text>
        <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{roleLine(member)}</Text>
      </View>

      <FormSection title={t("mobileApp.profile.account")}>
        <InfoRow label={t("mobileApp.signIn.email")} value={member.email} />
        <InfoRow label={t("mobileApp.signIn.server")} value={session.server.replace(/^https?:\/\//, "")} last />
      </FormSection>

      <View className="gap-2">
        <Text className="px-1 text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">{t("mobileApp.profile.appearance")}</Text>
        {appearance}
      </View>

      <FormSection title={t("mobileApp.sync.title")}>
        <FormRow last>
          <Pressable
            testID="profile-sync"
            onPress={() => router.push("/sync")}
            accessibilityRole="button"
            accessibilityLabel={t("mobileApp.syncPill.label", { label: syncLabel })}
            className="min-h-[44px] flex-1 flex-row items-center gap-3"
          >
            {waiting === 0 ? <CircleCheck size={20} color={colors.paid} /> : <CloudUpload size={20} color={colors.dueSoon} />}
            <Text className="flex-1 text-[15px] text-on-surface dark:text-on-surface-dark">{syncLabel}</Text>
            <ChevronRight size={18} color={colors.onSurfaceMuted} />
          </Pressable>
        </FormRow>
      </FormSection>

      {member.role === "field" ? <Text className="px-1 text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{FIELD_NOTE}</Text> : null}

      <FullWidthButton variant="danger" label={t("mobileApp.signOut.signOut")} testID="profile-sign-out" onPress={signOutPress} />

      {version}
    </ScrollView>
  );
}
