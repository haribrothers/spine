import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Modal, Pressable, Text, TextInput, View, useWindowDimensions, type AccessibilityActionEvent } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Trash2 from "lucide-react-native/icons/trash-2";
import WifiOff from "lucide-react-native/icons/wifi-off";
import X from "lucide-react-native/icons/x";
import { Toast, useNativeColors, useToast } from "@spine/ui-native";
import { darkColors } from "@spine/ui-native/tokens";
import { useCachedQuery } from "../../lib/data/use-cached-query";
import { milestonesKey, photosKey, type FieldMilestone, type JobPhoto } from "../../lib/data/jobs";
import { useFileUri } from "../../lib/data/files";
import { useBusinessFormat } from "../../lib/data/business";
import { useOnline } from "../../lib/connectivity";
import { useOutboxItems } from "../../lib/outbox/pending";
import { jobWaiting } from "../../lib/outbox/job-waiting";
import { outbox } from "../../lib/outbox/outbox";
import { useSession } from "../../lib/session/session-provider";
import { OfflineError } from "../../lib/api/errors";
import { useCameraInk } from "../../lib/camera/ink";
import { relativeTime } from "../../lib/format";
import { useT } from "../../lib/i18n";
import { alertNeedsConnection } from "../quotes/needs-connection";
import { ZoomablePhoto } from "./zoomable-photo";
import { tileKey, type TilePhoto } from "./job-detail-screen";

const takenAt = (tile: TilePhoto) => (tile.kind === "sent" ? tile.photo.createdAt : tile.createdAt);

/** The job's photos in the order both photo screens show them: waiting and sent together, newest first. */
export function viewerTiles(waiting: TilePhoto[], sent: JobPhoto[]): TilePhoto[] {
  return [...waiting, ...sent.map((photo) => ({ kind: "sent" as const, photo }))].sort((a, b) => Date.parse(takenAt(b)) - Date.parse(takenAt(a)));
}

/**
 * US-MOB-30 / US-MOB-31 (D-277) · `MobPhotoViewer`, `MobPhotoViewerAndroid`
 * — a job's photos full screen, dark in both themes like the camera:
 * "<n> of <total>", swipe between them (VoiceOver/TalkBack: Next and
 * Previous photo), pinch or double-tap to zoom, swipe down or Close to go
 * back. A sent photo the person may delete (the API's `canDelete`) offers
 * "Delete photo", which needs a connection and is never queued; a locked
 * one (Owners only) asks for a reason. A photo still waiting to send offers
 * "Discard", which takes it out of the outbox. No Save or Share.
 */
export function PhotoViewerScreen({ jobId, startKey }: { jobId: string; startKey: string }) {
  const t = useT();
  const router = useRouter();
  const ink = useCameraInk();
  const danger = darkColors.overdue;
  const online = useOnline();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { request } = useSession();
  const { locale } = useBusinessFormat();
  const photos = useCachedQuery<JobPhoto[]>(photosKey(jobId), `/jobs/${jobId}/photos`);
  const milestones = useCachedQuery<FieldMilestone[]>(milestonesKey(jobId), `/jobs/${jobId}/milestones`);
  const queued = useOutboxItems();
  const [gone, setGone] = useState<string[]>([]);
  const [currentKey, setCurrentKey] = useState(startKey);
  const [zoomed, setZoomed] = useState(false);
  const toast = useToast();
  const colors = useNativeColors();
  const [asking, setAsking] = useState<JobPhoto | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const pager = useRef<FlatList<TilePhoto>>(null);
  const shown = useRef(-1);

  const tiles = useMemo(() => {
    const waiting = jobWaiting(queued, jobId).photos.map(({ photo, queuedAt, itemId }) => ({ kind: "waiting" as const, key: photo.uri, localUri: photo.uri, createdAt: new Date(queuedAt).toISOString(), itemId, caption: photo.caption ?? null }));
    return viewerTiles(waiting, photos.data ?? []).filter((tile) => !gone.includes(tileKey(tile)));
  }, [queued, jobId, photos.data, gone]);

  // The open photo is tracked by key, so it stays put while the list loads, re-sorts or loses a photo.
  const index = Math.max(0, tiles.findIndex((tile) => tileKey(tile) === currentKey));
  const current = tiles[index];
  useEffect(() => {
    if (!tiles.length || shown.current === index) return;
    shown.current = index;
    requestAnimationFrame(() => pager.current?.scrollToIndex({ index, animated: false }));
  }, [index, tiles.length]);

  const close = useCallback(() => router.back(), [router]);

  const goTo = useCallback(
    (next: number) => {
      const tile = tiles[next];
      if (!tile) return;
      shown.current = next;
      setCurrentKey(tileKey(tile));
      pager.current?.scrollToIndex({ index: next, animated: !reduceMotion });
    },
    [tiles, reduceMotion],
  );

  function afterRemoving(key: string, message: string) {
    const rest = tiles.filter((tile) => tileKey(tile) !== key);
    setGone((g) => [...g, key]);
    if (!rest.length) {
      close();
      return;
    }
    // The next photo, or the one before when it was the last.
    setCurrentKey(tileKey(rest[Math.min(index, rest.length - 1)]!));
    toast.show(message);
  }

  async function runDelete(photo: JobPhoto, withReason: string | null) {
    setBusy(true);
    try {
      await request("DELETE", `/jobs/${jobId}/photos/${photo.id}`, { body: withReason ? { reason: withReason } : {}, idempotencyKey: `photo-delete-${photo.id}-${Date.now()}` });
      afterRemoving(photo.id, t("mobileWork.photoViewer.deleted"));
      void photos.refresh();
    } catch (error) {
      if (error instanceof OfflineError) alertNeedsConnection(() => void runDelete(photo, withReason));
      else Alert.alert(t("mobileWork.photoViewer.failed"), error instanceof Error ? error.message : undefined);
      void photos.refresh();
    } finally {
      setBusy(false);
      setAsking(null);
    }
  }

  function askDelete(photo: JobPhoto) {
    if (photo.locked) {
      setReason("");
      setAsking(photo);
      return;
    }
    Alert.alert(t("mobileWork.photoViewer.deleteTitle"), t("mobileWork.photoViewer.deleteBody"), [
      { text: t("mobileWork.photoViewer.cancel"), style: "cancel" },
      { text: t("mobileWork.photoViewer.delete"), style: "destructive", onPress: () => void runDelete(photo, null) },
    ]);
  }

  function askDiscard(tile: Extract<TilePhoto, { kind: "waiting" }>) {
    Alert.alert(t("mobileWork.photoViewer.discardTitle"), t("mobileWork.photoViewer.discardBody"), [
      { text: t("mobileWork.photoViewer.keep"), style: "cancel" },
      {
        text: t("mobileWork.photoViewer.discard"),
        style: "destructive",
        onPress: () => {
          const item = outbox.get(tile.itemId);
          const last = item && item.kind === "photos" && item.payload.photos.length <= 1;
          void (last ? outbox.remove(tile.itemId) : outbox.removePhoto(tile.itemId, tile.localUri)).then(() => afterRemoving(tile.key, t("mobileWork.photoViewer.discarded")));
        },
      },
    ]);
  }

  const milestoneName = (id: string | null) => (id ? ((milestones.data ?? []).find((m) => m.id === id)?.name ?? null) : null);
  const position = tiles.length ? t("mobileWork.photoViewer.position", { n: index + 1, total: tiles.length }) : "";
  const actions = [
    { name: "next", label: t("mobileWork.photoViewer.next") },
    { name: "previous", label: t("mobileWork.photoViewer.previous") },
  ];
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "next") goTo(index + 1);
    if (event.nativeEvent.actionName === "previous") goTo(index - 1);
  };
  const pageHeight = Math.round(width * 0.75);

  return (
    <View style={{ flex: 1, backgroundColor: ink.base }} testID="photo-viewer">
      <Stack.Screen options={{ animation: reduceMotion ? "none" : "fade" }} />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t("mobileWork.photoViewer.close")} testID="photo-viewer-close" style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: ink.glass }}>
          <X size={20} color={ink.ink} />
        </Pressable>
        <Text style={{ color: ink.ink, fontSize: 17, fontWeight: "600" }} testID="photo-viewer-position" accessibilityRole="header">
          {position}
        </Text>
        <View style={{ width: 44, height: 44 }} />
      </View>

      <View style={{ flex: 1, justifyContent: "center" }}>
        <FlatList
          ref={pager}
          data={tiles}
          horizontal
          pagingEnabled
          contentInsetAdjustmentBehavior="never"
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          keyExtractor={tileKey}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            shown.current = i;
            if (tiles[i]) setCurrentKey(tileKey(tiles[i]));
          }}
          renderItem={({ item, index: i }) => (
            <ViewerPage
              tile={item}
              width={width}
              height={Math.min(pageHeight, height * 0.6)}
              label={t("mobileWork.photoViewer.photoAria", { n: i + 1, total: tiles.length })}
              online={online}
              reduceMotion={reduceMotion}
              onZoomChange={setZoomed}
              onClose={close}
              actions={actions}
              onAction={onAction}
            />
          )}
        />
      </View>

      {current ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 20, gap: 6 }} testID="photo-viewer-details">
          {current.kind === "waiting" ? (
            <View style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: darkColors.dueSoonBg }}>
              <Text style={{ color: darkColors.dueSoon, fontSize: 12, fontWeight: "600" }}>{t("mobileWork.photoViewer.waitingToSend")}</Text>
            </View>
          ) : null}
          {(current.kind === "sent" ? current.photo.caption : current.caption) ? (
            <Text style={{ color: ink.ink, fontSize: 17, fontWeight: "600" }}>{current.kind === "sent" ? current.photo.caption : current.caption}</Text>
          ) : null}
          <Text style={{ color: ink.ink, opacity: 0.85, fontSize: 15 }}>
            {(current.kind === "sent" ? milestoneName(current.photo.milestoneId) : null) ?? t("mobileWork.photoViewer.sitePhoto")}
          </Text>
          <Text style={{ color: ink.ink, opacity: 0.85, fontSize: 13 }}>
            {current.kind === "waiting"
              ? t("mobileWork.photoViewer.savedOnPhone", { when: relativeTime(current.createdAt, locale) })
              : current.photo.uploadedByName
                ? t("mobileWork.photoViewer.addedBy", { name: current.photo.uploadedByName, when: relativeTime(current.photo.createdAt, locale) })
                : t("mobileWork.photoViewer.added", { when: relativeTime(current.photo.createdAt, locale) })}
          </Text>

          {current.kind === "waiting" ? (
            <ActionButton label={t("mobileWork.photoViewer.discard")} color={danger} glass={ink.glass} onPress={() => askDiscard(current)} testID="photo-viewer-discard" />
          ) : current.photo.canDelete ? (
            online ? (
              <ActionButton label={t("mobileWork.photoViewer.delete")} color={danger} glass={ink.glass} disabled={busy} onPress={() => askDelete(current.photo)} testID="photo-viewer-delete" />
            ) : (
              <View style={{ gap: 10 }}>
                <ActionButton label={t("mobileWork.photoViewer.delete")} color={ink.ink} glass={ink.glass} disabled describedBy={t("mobileWork.photoViewer.connectToDelete")} onPress={() => undefined} testID="photo-viewer-delete" />
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <WifiOff size={16} color={ink.ink} />
                  <Text style={{ color: ink.ink, opacity: 0.85, fontSize: 13 }}>{t("mobileWork.photoViewer.connectToDelete")}</Text>
                </View>
              </View>
            )
          ) : null}
        </View>
      ) : null}

      {toast.message ? (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 96 }} accessibilityLiveRegion="polite">
          <Toast {...toast.message} onDismiss={toast.dismiss} />
        </View>
      ) : null}

      <Modal visible={asking !== null} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => !busy && setAsking(null)}>
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.scrim }}>
          <View className="w-full gap-3 rounded-xl bg-surface p-5 dark:bg-surface-dark" testID="photo-reason-sheet">
            <Text className="text-[17px] font-semibold text-on-surface dark:text-on-surface-dark" accessibilityRole="header">
              {t("mobileWork.photoViewer.lockedTitle")}
            </Text>
            <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{t("mobileWork.photoViewer.lockedBody")}</Text>
            <Text className="text-[13px] font-medium text-on-surface dark:text-on-surface-dark" nativeID="photo-reason-label">
              {t("mobileWork.photoViewer.reason")}
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={500}
              accessibilityLabel={t("mobileWork.photoViewer.reason")}
              accessibilityLabelledBy="photo-reason-label"
              testID="photo-reason"
              className="min-h-[88px] rounded-md border border-border-strong px-3 py-2 text-[15px] text-on-surface dark:border-border-strong-dark dark:text-on-surface-dark"
            />
            <View className="flex-row justify-end gap-2">
              <Pressable onPress={() => setAsking(null)} disabled={busy} accessibilityRole="button" className="h-11 justify-center px-4">
                <Text className="text-[15px] font-medium text-primary dark:text-primary-dark">{t("mobileWork.photoViewer.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={() => asking && void runDelete(asking, reason.trim())}
                disabled={busy || !reason.trim()}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy || !reason.trim() }}
                testID="photo-reason-delete"
                className="h-11 justify-center rounded-lg bg-overdue px-4 dark:bg-overdue-dark"
                style={{ opacity: busy || !reason.trim() ? 0.4 : 1 }}
              >
                <Text className="text-[15px] font-semibold text-on-danger dark:text-on-danger-dark">{t("mobileWork.photoViewer.delete")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ViewerPage({
  tile,
  width,
  height,
  label,
  online,
  reduceMotion,
  onZoomChange,
  onClose,
  actions,
  onAction,
}: {
  tile: TilePhoto;
  width: number;
  height: number;
  label: string;
  online: boolean;
  reduceMotion: boolean;
  onZoomChange: (zoomed: boolean) => void;
  onClose: () => void;
  actions: { name: string; label: string }[];
  onAction: (event: AccessibilityActionEvent) => void;
}) {
  const t = useT();
  const ink = useCameraInk();
  const sent = useFileUri(tile.kind === "sent" ? tile.photo.fileId : "");
  const uri = tile.kind === "sent" ? sent : tile.localUri;
  return (
    <View style={{ width, justifyContent: "center", alignItems: "center" }}>
      {uri ? (
        <ZoomablePhoto uri={uri} label={label} width={width} height={height} reduceMotion={reduceMotion} onZoomChange={onZoomChange} onClose={onClose} accessibilityActions={actions} onAccessibilityAction={onAction} testID={`viewer-photo-${tileKey(tile)}`} />
      ) : !online ? (
        <View style={{ width, height, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }} testID="photo-viewer-not-cached">
          <Text style={{ color: ink.ink, opacity: 0.85, fontSize: 15, textAlign: "center" }}>{t("mobileWork.photoViewer.notCached")}</Text>
        </View>
      ) : (
        <View style={{ width, height }} />
      )}
    </View>
  );
}

function ActionButton({ label, color, glass, onPress, disabled, describedBy, testID }: { label: string; color: string; glass: string; onPress: () => void; disabled?: boolean; describedBy?: string; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={describedBy}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={{ marginTop: 14, height: 50, borderRadius: 12, backgroundColor: glass, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.45 : 1 }}
    >
      <Trash2 size={20} color={color} />
      <Text style={{ color, fontSize: 17, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
