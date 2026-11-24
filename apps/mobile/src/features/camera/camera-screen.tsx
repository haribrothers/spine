import { useMemo, useRef, useState } from "react";
import { Alert, Image, Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, type FlashMode } from "expo-camera";
import Check from "lucide-react-native/icons/check";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import ImageIcon from "lucide-react-native/icons/image";
import X from "lucide-react-native/icons/x";
import Zap from "lucide-react-native/icons/zap";
import ZapOff from "lucide-react-native/icons/zap-off";
import { useCameraInk } from "../../lib/camera/ink";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { outbox } from "../../lib/outbox/outbox";
import { pickPhoto } from "../../lib/outbox/pick-photo";
import { cameraHandoff } from "../../lib/camera/handoff";
import type { LocalPhoto } from "../../lib/outbox/types";
import { useAssignedJobs } from "../../lib/data/jobs";
import { PickerSheet } from "../../components/picker-sheet";
import { CameraPermissionGate } from "./camera-permission";
import { PhotoReview } from "./photo-review";
import { useAndroidBack } from "../../lib/use-android-back";
import { t as translate, useT } from "../../lib/i18n";

export type CameraMode = "photos" | "milestone" | "receipt";

/** "2 taken · saved on this phone". */
export function takenLabel(count: number): string {
  return translate("mobileWork.camera.taken", { n: count });
}

export { useCameraInk };

/** Round glass control on the camera (close, flash). */
function GlassButton({ label, onPress, children, testID }: { label: string; onPress: () => void; children: React.ReactNode; testID?: string }) {
  const { glass } = useCameraInk();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: glass }}>
      {children}
    </Pressable>
  );
}

/**
 * US-MOB-11 · `MobPhotoCapture`, US-MOB-13 · `MobReceiptCapture` (and
 * Android) — the in-app camera, behind the camera explainer (US-MOB-14).
 * `photos`: the job at the top (with a picker), flash, shutter, "<n> taken ·
 * saved on this phone", the latest thumbnail with its count and "Done",
 * which opens the review. `milestone`: the same, handing the photos back to
 * Mark complete. `receipt`: one photo inside a frame, or one from the phone.
 */
export function CameraScreen({ mode, jobId: initialJobId, request }: { mode: CameraMode; jobId?: string; request?: string }) {
  const t = useT();
  const router = useRouter();
  const { ink, onInk, glass, base, primary, onPrimary } = useCameraInk();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const listed = useAssignedJobs(false).data;
  const jobs = useMemo(() => listed ?? [], [listed]);
  const [jobId, setJobId] = useState<string | null>(initialJobId ?? jobs[0]?.id ?? null);
  const [flash, setFlash] = useState<FlashMode>("off");
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [choosingJob, setChoosingJob] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const job = useMemo(() => jobs.find((j) => j.id === jobId) ?? null, [jobs, jobId]);

  const finish = (taken: LocalPhoto[]) => {
    if (request) cameraHandoff.deliver(request, taken);
    router.back();
  };

  const close = () => {
    if (!photos.length || mode !== "photos") {
      photos.forEach((p) => outbox.discardPhoto(p));
      router.back();
      return;
    }
    Alert.alert(t("mobileWork.camera.discardTitle", { count: photos.length }), t("mobileWork.camera.discardMessage"), [
      { text: t("mobileWork.camera.keepTaking"), style: "cancel" },
      {
        text: t("mobileWork.camera.discard"),
        style: "destructive",
        onPress: () => {
          photos.forEach((p) => outbox.discardPhoto(p));
          router.back();
        },
      },
    ]);
  };
  useAndroidBack(close);

  const shoot = async () => {
    if (busy || !camera.current) return;
    setBusy(true);
    try {
      const shot = await camera.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (!shot) return;
      const kept = await outbox.keepPhoto(shot.uri, { width: shot.width, height: shot.height, name: mode === "receipt" ? "receipt" : undefined });
      if (mode === "receipt") finish([kept]);
      else setPhotos((prev) => [...prev, kept]);
    } finally {
      setBusy(false);
    }
  };

  if (reviewing && mode === "photos") {
    return (
      <PhotoReview
        photos={photos}
        jobId={jobId}
        onJobChange={setJobId}
        onPhotosChange={setPhotos}
        onAddMore={() => setReviewing(false)}
        onSaved={() => router.back()}
        onClose={close}
      />
    );
  }

  const receipt = mode === "receipt";
  const android = Platform.OS === "android";
  return (
    <CameraPermissionGate>
      <View testID={`camera-${mode}`} className="flex-1" style={{ backgroundColor: base }}>
        <CameraView ref={camera} style={{ flex: 1 }} facing="back" flash={flash} />
        {/* Top bar */}
        <View className="absolute left-0 right-0 flex-row items-center justify-between px-4" style={{ top: insets.top + 8 }}>
          {receipt && !android ? (
            <Pressable onPress={close} accessibilityRole="button" className="min-h-[44px] justify-center rounded-full px-4" style={{ backgroundColor: glass }}>
              <Text className="text-[16px] font-medium" style={{ color: ink }}>{t("mobileWork.common.cancel")}</Text>
            </Pressable>
          ) : receipt ? (
            // US-MOB-20 · `MobReceiptCaptureAndroid`: ✕ with the title beside it.
            <View className="flex-1 flex-row items-center gap-4">
              <GlassButton testID="camera-close" label={t("mobileWork.common.close")} onPress={close}>
                <X size={22} color={ink} />
              </GlassButton>
              <Text accessibilityRole="header" className="text-[20px]" style={{ color: ink }}>
                {t("mobileWork.camera.receipt")}
              </Text>
            </View>
          ) : (
            <GlassButton testID="camera-close" label={t("mobileWork.common.close")} onPress={close}>
              <X size={22} color={ink} />
            </GlassButton>
          )}
          {receipt && android ? null : receipt ? (
            <Text accessibilityRole="header" className="text-[17px] font-semibold" style={{ color: ink }}>{t("mobileWork.camera.receipt")}</Text>
          ) : (
            <Pressable
              testID="camera-job"
              disabled={mode !== "photos"}
              onPress={() => setChoosingJob(true)}
              accessibilityRole="button"
              accessibilityLabel={t(mode === "photos" ? "mobileWork.camera.jobA11yChange" : "mobileWork.camera.jobA11y", { name: job?.name ?? t("mobileWork.camera.chooseAJobLower") })}
              className="max-w-[60%] min-h-[44px] flex-row items-center gap-2 rounded-full px-4"
              style={{ backgroundColor: glass }}
            >
              <Text numberOfLines={1} className="flex-shrink text-[16px] font-semibold" style={{ color: ink }}>
                {job?.name ?? t("mobileWork.common.chooseAJob")}
              </Text>
              {mode === "photos" ? <ChevronDown size={18} color={ink} /> : null}
            </Pressable>
          )}
          <GlassButton testID="camera-flash" label={flash === "on" ? t("mobileWork.camera.flashOn") : t("mobileWork.camera.flashOff")} onPress={() => setFlash((f) => (f === "on" ? "off" : "on"))}>
            {flash === "on" ? <Zap size={22} color={ink} /> : <ZapOff size={22} color={ink} />}
          </GlassButton>
        </View>

        {receipt ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center gap-4">
            <View className="h-[60%] w-[72%] rounded-2xl border-2" style={{ borderColor: ink }} />
            <View className="rounded-full px-4 py-2" style={{ backgroundColor: glass }}>
              <Text className="text-[15px] font-medium" style={{ color: ink }}>
                {t("mobileWork.camera.fitReceipt")}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Bottom bar */}
        <View className="absolute left-0 right-0 items-center gap-5" style={{ bottom: insets.bottom + 16 }}>
          {!receipt && photos.length ? (
            <View testID="camera-taken" className="flex-row items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: glass }}>
              <Check size={16} color={ink} />
              <Text className="text-[15px] font-medium" style={{ color: ink }}>
                {takenLabel(photos.length)}
              </Text>
            </View>
          ) : null}
          <View className="w-full flex-row items-center justify-between px-6">
            {receipt ? (
              <GlassButton
                testID="camera-gallery"
                label={t("mobileWork.camera.choosePhoto")}
                onPress={async () => {
                  const picked = await pickPhoto("library");
                  if (picked) finish([picked]);
                }}
              >
                <ImageIcon size={22} color={ink} />
              </GlassButton>
            ) : photos.length ? (
              <View accessible accessibilityLabel={t("mobileWork.camera.photosTaken", { n: photos.length })} className="h-14 w-14">
                <Image source={{ uri: photos[photos.length - 1]!.uri }} className="h-14 w-14 rounded-lg border-2" style={{ borderColor: ink }} />
                <View className="absolute -right-2 -top-2 h-6 min-w-[24px] items-center justify-center rounded-full px-1" style={{ backgroundColor: primary }}>
                  <Text className="text-[13px] font-bold" style={{ color: onPrimary }}>
                    {photos.length}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="h-14 w-14" />
            )}
            <Pressable
              testID="camera-shutter"
              onPress={() => void shoot()}
              disabled={busy || (mode === "photos" && !job)}
              accessibilityRole="button"
              accessibilityLabel={t("mobileWork.camera.takePhoto")}
              className="h-20 w-20 items-center justify-center rounded-full border-4"
              style={{ opacity: busy ? 0.6 : 1, borderColor: ink }}
            >
              <View className="h-16 w-16 rounded-full" style={{ backgroundColor: ink }} />
            </Pressable>
            {receipt ? (
              <View className="h-14 w-14" />
            ) : (
              <Pressable
                testID="camera-done"
                disabled={!photos.length}
                onPress={() => (mode === "photos" ? setReviewing(true) : finish(photos))}
                accessibilityRole="button"
                accessibilityState={{ disabled: !photos.length }}
                className="min-h-[48px] justify-center rounded-full px-5"
                style={{ opacity: photos.length ? 1 : 0.5, backgroundColor: ink }}
              >
                <Text className="text-[16px] font-semibold" style={{ color: onInk }}>
                  {t("mobileWork.common.done")}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        <PickerSheet
          testID="camera-job-picker"
          visible={choosingJob}
          title={t("mobileWork.camera.photosFor")}
          value={jobId}
          options={jobs.map((j) => ({ value: j.id, label: j.name, detail: j.contactName }))}
          onPick={setJobId}
          onClose={() => setChoosingJob(false)}
        />
      </View>
    </CameraPermissionGate>
  );
}
