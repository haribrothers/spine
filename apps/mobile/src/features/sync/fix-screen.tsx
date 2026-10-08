import { Alert, Image, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Camera from "lucide-react-native/icons/camera";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import ImagePlus from "lucide-react-native/icons/image-plus";
import Trash2 from "lucide-react-native/icons/trash-2";
import X from "lucide-react-native/icons/x";
import { EmptyState, useNativeColors } from "@spine/ui-native";
import { useOutboxItems } from "../../lib/outbox/pending";
import { outbox } from "../../lib/outbox/outbox";
import { syncEngine } from "../../lib/outbox/sync-engine";
import { formatBytes } from "../../lib/outbox/local-files";
import { pickPhoto } from "../../lib/outbox/pick-photo";
import { MAX_UPLOAD_BYTES, type LocalPhoto, type OutboxItem } from "../../lib/outbox/types";
import { useBusinessFormat } from "../../lib/data/business";
import { calendarDay, money, weekdayDayMonth } from "../../lib/format";

const DELETE_LABEL: Record<OutboxItem["kind"], string> = { expense: "Delete this expense", photos: "Delete these photos", completion: "Delete this update" };
const TITLE: Record<OutboxItem["kind"], string> = { expense: "Fix expense", photos: "Fix photos", completion: "Fix milestone update" };

function DetailRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View className={`flex-row justify-between gap-4 px-4 py-3 ${first ? "" : "border-t border-border dark:border-border-dark"}`}>
      <Text className="text-[15px] text-on-surface-muted dark:text-on-surface-muted-dark">{label}</Text>
      <Text className="flex-1 text-right text-[15px] text-on-surface dark:text-on-surface-dark">{value}</Text>
    </View>
  );
}

function PhotoCard({ photo, onRemove }: { photo: LocalPhoto; onRemove?: () => void }) {
  const colors = useNativeColors();
  const tooBig = photo.size > MAX_UPLOAD_BYTES;
  return (
    <View testID="fix-photo" className="flex-row items-center gap-3 rounded-2xl bg-surface p-3 dark:bg-surface-dark">
      <Image source={{ uri: photo.uri }} accessibilityLabel={photo.name} className="h-[72px] w-[72px] rounded-lg" resizeMode="cover" />
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} className="text-[16px] font-semibold text-on-surface dark:text-on-surface-dark">{photo.name}</Text>
        <Text testID="fix-photo-size" className={`text-[14px] ${tooBig ? "text-overdue dark:text-overdue-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark"}`}>
          {formatBytes(photo.size)}
          {tooBig ? " · over the 10 MB limit" : ""}
        </Text>
      </View>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${photo.name}`} className="h-11 w-11 items-center justify-center">
          <X size={20} color={colors.onSurfaceMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ActionButton({ label, icon: Icon, tone, onPress, testID }: { label: string; icon?: React.ComponentType<{ size?: number; color?: string }>; tone: "primary" | "soft" | "outline" | "danger" | "danger-text"; onPress: () => void; testID?: string }) {
  const colors = useNativeColors();
  const box = {
    primary: "bg-primary dark:bg-primary-dark",
    soft: "bg-info-bg dark:bg-info-bg-dark",
    outline: "border border-border-strong dark:border-border-strong-dark",
    danger: "bg-overdue-bg dark:bg-overdue-bg-dark",
    "danger-text": "",
  }[tone];
  const text = tone === "primary" ? "text-on-primary dark:text-on-primary-dark" : tone === "danger" || tone === "danger-text" ? "text-overdue dark:text-overdue-dark" : "text-primary dark:text-primary-dark";
  const iconColor = tone === "danger" || tone === "danger-text" ? colors.overdue : colors.primary;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-full px-5 active:opacity-70 ${box}`}>
      {Icon ? <Icon size={18} color={iconColor} /> : null}
      <Text className={`text-[16px] font-semibold ${text}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * US-MOB-09 · `MobSyncFix` (and Android) — an item the server refused: the
 * reason in red, what it is, and what can change. A rejected expense shows
 * its details and receipt with "Retake photo", "Choose a different photo",
 * "Remove photo", "Send again" and "Delete this expense" (on Android the
 * bin in the top bar). Photos and milestone updates can lose a photo and
 * be sent again, or be deleted.
 */
export function FixScreen({ id }: { id: string }) {
  const router = useRouter();
  const colors = useNativeColors();
  const format = useBusinessFormat();
  const item = useOutboxItems().find((candidate) => candidate.id === id);
  const android = Platform.OS === "android";

  if (!item || item.status !== "failed") {
    return (
      <View className="flex-1 justify-center bg-background p-4 dark:bg-background-dark">
        <EmptyState title="Nothing to fix" description="This item was sent or deleted." />
      </View>
    );
  }

  const sendAgain = async () => {
    router.back();
    await syncEngine.resend(item.id);
  };
  const confirmDelete = () =>
    Alert.alert(`${DELETE_LABEL[item.kind]}?`, "It's removed from this phone and never reaches your office.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          router.back();
          void outbox.remove(item.id);
        },
      },
    ]);
  const replaceReceipt = async (source: "camera" | "library") => {
    const next = await pickPhoto(source);
    if (next) await outbox.setReceipt(item.id, next);
  };

  return (
    <ScrollView testID="fix-screen" contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="gap-4 px-4 pb-16 pt-4">
      <Stack.Screen
        options={{
          title: TITLE[item.kind],
          ...(android
            ? {
                headerRight: () => (
                  <Pressable testID="fix-delete-icon" onPress={confirmDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel={DELETE_LABEL[item.kind]} className="h-11 w-11 items-center justify-center">
                    <Trash2 size={22} color={colors.overdue} />
                  </Pressable>
                ),
              }
            : {}),
        }}
      />
      <View accessibilityRole="alert" className="flex-row items-start gap-3 rounded-xl bg-overdue-bg px-4 py-3.5 dark:bg-overdue-bg-dark">
        <CircleAlert size={20} color={colors.overdue} />
        <Text testID="fix-reason" className="flex-1 text-[16px] font-semibold text-overdue dark:text-overdue-dark">{item.error}</Text>
      </View>

      <View className={`overflow-hidden rounded-2xl bg-surface dark:bg-surface-dark ${android ? "border border-border dark:border-border-dark" : ""}`}>
        {item.kind === "expense" ? (
          <>
            <DetailRow first label="Category" value={item.payload.categoryName} />
            <DetailRow label="Amount" value={money(item.payload.amount, { currency: item.payload.currency, locale: format.locale })} />
            {item.payload.jobName ? <DetailRow label="Job" value={item.payload.jobName} /> : null}
            <DetailRow label="Date" value={weekdayDayMonth(calendarDay(item.payload.date), format.locale)} />
          </>
        ) : item.kind === "completion" ? (
          <>
            <DetailRow first label="Milestone" value={item.payload.milestoneName} />
            <DetailRow label="Job" value={item.payload.jobName} />
          </>
        ) : (
          <DetailRow first label="Job" value={item.payload.jobName} />
        )}
      </View>

      {item.kind === "expense" ? (
        <>
          {item.payload.receipt ? <PhotoCard photo={item.payload.receipt} /> : <Text className="px-1 text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">No receipt photo.</Text>}
          <View className="gap-3">
            <ActionButton testID="fix-retake" label={item.payload.receipt ? "Retake photo" : "Take photo"} icon={Camera} tone="soft" onPress={() => void replaceReceipt("camera")} />
            <ActionButton testID="fix-choose" label={item.payload.receipt ? "Choose a different photo" : "Choose a photo"} icon={ImagePlus} tone={android ? "outline" : "soft"} onPress={() => void replaceReceipt("library")} />
            {item.payload.receipt ? <ActionButton testID="fix-remove-photo" label="Remove photo" icon={Trash2} tone={android ? "danger-text" : "danger"} onPress={() => void outbox.setReceipt(item.id, null)} /> : null}
          </View>
        </>
      ) : (
        <View className="gap-2">
          {item.payload.photos.map((photo) => (
            <PhotoCard key={photo.uri} photo={photo} onRemove={() => void outbox.removePhoto(item.id, photo.uri)} />
          ))}
        </View>
      )}

      <ActionButton testID="fix-send-again" label="Send again" tone="primary" onPress={() => void sendAgain()} />
      {android ? (
        <Text className="px-1 text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">{`“${DELETE_LABEL[item.kind]}” is the bin icon at the top. It removes it from this phone.`}</Text>
      ) : (
        <ActionButton testID="fix-delete" label={DELETE_LABEL[item.kind]} tone="danger-text" onPress={confirmDelete} />
      )}
    </ScrollView>
  );
}
