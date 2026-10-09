import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CloudUpload from "lucide-react-native/icons/cloud-upload";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import { useNativeColors } from "@spine/ui-native";
import { useOutboxItems } from "../../lib/outbox/pending";
import { useSyncState } from "../../lib/outbox/hooks";
import { syncEngine, type SyncProblem } from "../../lib/outbox/sync-engine";
import { describeItem, waitingTitle } from "../../lib/outbox/describe";
import { useBusinessFormat } from "../../lib/data/business";
import { useOnline } from "../../lib/connectivity";
import { SectionHeader } from "../../components/section-header";
import { OutboxItemIcon } from "./item-icon";

export const ALL_SYNCED_MESSAGE = "Everything has reached your office.";

/** The line under "<n> items waiting" (US-MOB-08). */
export function syncReason(problem: SyncProblem, online: boolean, sending: boolean): string {
  if (!online || problem === "offline") return "You're offline · sends automatically when you reconnect";
  if (problem === "updateRequired") return "Update Spine to send them · they're kept on this phone";
  if (problem === "signedOut") return "Sign in again to send them · they're kept on this phone";
  if (sending) return "Sending now…";
  if (problem === "unreachable") return "Couldn't reach your Spine server · tries again automatically";
  return "Sends automatically";
}

function Group({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return (
    <View testID={testID} className={Platform.OS === "ios" ? "overflow-hidden rounded-2xl bg-surface dark:bg-surface-dark" : ""}>
      {children}
    </View>
  );
}

function Row({ first, children, testID }: { first: boolean; children: React.ReactNode; testID?: string }) {
  return (
    <View testID={testID} className={`flex-row items-center gap-3 px-4 py-3 ${first || Platform.OS === "android" ? "" : "border-t border-border dark:border-border-dark"}`}>
      {children}
    </View>
  );
}

/**
 * US-MOB-08, US-MOB-09 · `MobSyncQueue` (and Android) — what hasn't reached
 * the office: "<n> items waiting" and why, "Try sending now", NEEDS FIXING
 * (refused, with the reason and "Fix"), WAITING (what, which job, when) and
 * SENT TODAY. Opened from the sync pill, Profile's Sync row and the
 * sign-out warning's "Send them first".
 */
export function SyncScreen() {
  const router = useRouter();
  const colors = useNativeColors();
  const format = useBusinessFormat();
  const items = useOutboxItems();
  const { sending, problem } = useSyncState();
  const online = useOnline();

  const failed = items.filter((item) => item.status === "failed");
  const waiting = items.filter((item) => item.status === "waiting" || item.status === "sending");
  const sent = [...items.filter((item) => item.status === "sent")].reverse();
  const open = failed.length + waiting.length;

  return (
    <ScrollView testID="sync-screen" contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="gap-5 px-4 pb-16 pt-4">
      <View className="flex-row items-start gap-3">
        <View className={`h-12 w-12 items-center justify-center rounded-xl ${open ? "bg-due-soon-bg dark:bg-due-soon-bg-dark" : "bg-paid-bg dark:bg-paid-bg-dark"}`}>
          {open ? <CloudUpload size={24} color={colors.dueSoon} /> : <CircleCheck size={24} color={colors.paid} />}
        </View>
        <View className="flex-1 gap-0.5">
          <Text testID="sync-title" accessibilityRole="header" className="text-[22px] font-semibold text-on-surface dark:text-on-surface-dark">
            {open ? waitingTitle(open) : "All synced"}
          </Text>
          <Text testID="sync-reason" className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">
            {open ? syncReason(problem, online, sending) : ALL_SYNCED_MESSAGE}
          </Text>
        </View>
      </View>

      {waiting.length ? (
        <Pressable
          testID="sync-now"
          disabled={sending}
          onPress={() => void syncEngine.run({ force: true })}
          accessibilityRole="button"
          accessibilityState={{ disabled: sending }}
          className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-full bg-info-bg px-5 active:opacity-70 dark:bg-info-bg-dark ${Platform.OS === "android" ? "self-start" : ""}`}
          style={{ opacity: sending ? 0.6 : 1 }}
        >
          <RefreshCw size={18} color={colors.primary} />
          <Text className="text-[16px] font-semibold text-primary dark:text-primary-dark">{sending ? "Sending…" : "Try sending now"}</Text>
        </Pressable>
      ) : null}

      {failed.length ? (
        <View className="gap-2">
          <Text accessibilityRole="header" className={Platform.OS === "ios" ? "px-1 text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark" : "text-[15px] font-medium text-overdue dark:text-overdue-dark"}>
            {Platform.OS === "ios" ? `NEEDS FIXING · ${failed.length}` : `Needs fixing · ${failed.length}`}
          </Text>
          <Group testID="sync-needs-fixing">
            {failed.map((item, index) => {
              const { title, icon } = describeItem(item, format);
              return (
                <Row key={item.id} first={index === 0} testID={`sync-failed-${item.id}`}>
                  <OutboxItemIcon icon={icon} state="failed" />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{title}</Text>
                    <Text className="text-[14px] text-overdue dark:text-overdue-dark">{item.error}</Text>
                  </View>
                  <Pressable
                    testID={`sync-fix-${item.id}`}
                    onPress={() => router.push(`/sync/fix/${item.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Fix ${title}`}
                    className="min-h-[44px] justify-center rounded-full bg-overdue-bg px-4 active:opacity-70 dark:bg-overdue-bg-dark"
                  >
                    <Text className="text-[15px] font-semibold text-overdue dark:text-overdue-dark">Fix</Text>
                  </Pressable>
                </Row>
              );
            })}
          </Group>
        </View>
      ) : null}

      {waiting.length ? (
        <View className="gap-2">
          <SectionHeader title="Waiting" />
          <Group testID="sync-waiting">
            {waiting.map((item, index) => {
              const { title, subtitle, icon } = describeItem(item, format);
              return (
                <Row key={item.id} first={index === 0} testID={`sync-waiting-${item.id}`}>
                  <OutboxItemIcon icon={icon} state="waiting" />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{title}</Text>
                    <Text numberOfLines={1} className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{subtitle}</Text>
                  </View>
                  {Platform.OS === "ios" ? (
                    <View className="rounded-full bg-draft-bg px-2.5 py-0.5 dark:bg-draft-bg-dark">
                      <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{item.status === "sending" ? "Sending" : "Waiting"}</Text>
                    </View>
                  ) : null}
                </Row>
              );
            })}
          </Group>
        </View>
      ) : null}

      {sent.length ? (
        <View className="gap-2">
          <SectionHeader title="Sent today" />
          <Group testID="sync-sent">
            {sent.map((item, index) => {
              const { title, subtitle, icon } = describeItem(item, format);
              return (
                <Row key={item.id} first={index === 0} testID={`sync-sent-${item.id}`}>
                  <OutboxItemIcon icon={icon} state="sent" />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{title}</Text>
                    <Text numberOfLines={1} className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{subtitle}</Text>
                  </View>
                </Row>
              );
            })}
          </Group>
        </View>
      ) : null}
    </ScrollView>
  );
}
