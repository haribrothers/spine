import { useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, type FlashMode } from "expo-camera";
import Check from "lucide-react-native/icons/check";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import ImageIcon from "lucide-react-native/icons/image";
import X from "lucide-react-native/icons/x";
import Zap from "lucide-react-native/icons/zap";
import ZapOff from "lucide-react-native/icons/zap-off";
import { useNativeColors, useTheme } from "@spine/ui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { outbox } from "../../lib/outbox/outbox";
import { pickPhoto } from "../../lib/outbox/pick-photo";
import { cameraHandoff } from "../../lib/camera/handoff";
import type { LocalPhoto } from "../../lib/outbox/types";
import { useAssignedJobs } from "../../lib/data/jobs";
import { PickerSheet } from "../../components/picker-sheet";
import { CameraPermissionGate } from "./camera-permission";
import { PhotoReview } from "./photo-review";

export type CameraMode = "photos" | "milestone" | "receipt";

/** "2 taken · saved on this phone". */
export function takenLabel(count: number): string {
  return `${count} taken · saved on this phone`;
}

/**
 * The camera is dark in both themes: controls are light "ink" on the token
 * scrim over a near-black base.
 */
export function useCameraInk() {
  const colors = useNativeColors();
  const { resolvedMode } = useTheme();
  const dark = resolvedMode === "dark";
  return { ink: dark ? colors.onSurface : colors.surface, onInk: dark ? colors.background : colors.onSurface, glass: colors.scrim, base: dark ? colors.background : colors.onSurface, primary: colors.primary, onPrimary: colors.onPrimary };
}

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
    Alert.alert(`Discard ${photos.length} ${photos.length === 1 ? "photo" : "photos"}?`, "They haven't been saved to the job.", [
      { text: "Keep taking", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          photos.forEach((p) => outbox.discardPhoto(p));
          router.back();
        },
      },
    ]);
  };

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
  return (
    <CameraPermissionGate>
      <View testID={`camera-${mode}`} className="flex-1" style={{ backgroundColor: base }}>
        <CameraView ref={camera} style={{ flex: 1 }} facing="back" flash={flash} />
        {/* Top bar */}
        <View className="absolute left-0 right-0 flex-row items-center justify-between px-4" style={{ top: insets.top + 8 }}>
          {receipt ? (
            <Pressable onPress={close} accessibilityRole="button" className="min-h-[44px] justify-center rounded-full px-4" style={{ backgroundColor: glass }}>
              <Text className="text-[16px] font-medium" style={{ color: ink }}>Cancel</Text>
            </Pressable>
          ) : (
            <GlassButton testID="camera-close" label="Close" onPress={close}>
              <X size={22} color={ink} />
            </GlassButton>
          )}
          {receipt ? (
            <Text accessibilityRole="header" className="text-[17px] font-semibold" style={{ color: ink }}>Receipt</Text>
          ) : (
            <Pressable
              testID="camera-job"
              disabled={mode !== "photos"}
              onPress={() => setChoosingJob(true)}
              accessibilityRole="button"
              accessibilityLabel={`Job: ${job?.name ?? "choose a job"}${mode === "photos" ? ". Change job" : ""}`}
              className="max-w-[60%] min-h-[44px] flex-row items-center gap-2 rounded-full px-4"
              style={{ backgroundColor: glass }}
            >
              <Text numberOfLines={1} className="flex-shrink text-[16px] font-semibold" style={{ color: ink }}>
                {job?.name ?? "Choose a job"}
              </Text>
              {mode === "photos" ? <ChevronDown size={18} color={ink} /> : null}
            </Pressable>
          )}
          <GlassButton testID="camera-flash" label={flash === "on" ? "Flash on" : "Flash off"} onPress={() => setFlash((f) => (f === "on" ? "off" : "on"))}>
            {flash === "on" ? <Zap size={22} color={ink} /> : <ZapOff size={22} color={ink} />}
          </GlassButton>
        </View>

        {receipt ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center gap-4">
            <View className="h-[60%] w-[72%] rounded-2xl border-2" style={{ borderColor: ink }} />
            <View className="rounded-full px-4 py-2" style={{ backgroundColor: glass }}>
              <Text className="text-[15px] font-medium" style={{ color: ink }}>
                Fit the whole receipt inside the frame
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
                label="Choose a photo"
                onPress={async () => {
                  const picked = await pickPhoto("library");
                  if (picked) finish([picked]);
                }}
              >
                <ImageIcon size={22} color={ink} />
              </GlassButton>
            ) : photos.length ? (
              <View accessible accessibilityLabel={`${photos.length} photos taken`} className="h-14 w-14">
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
              accessibilityLabel="Take photo"
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
                  Done
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        <PickerSheet
          testID="camera-job-picker"
          visible={choosingJob}
          title="Photos for"
          value={jobId}
          options={jobs.map((j) => ({ value: j.id, label: j.name, detail: j.contactName }))}
          onPick={setJobId}
          onClose={() => setChoosingJob(false)}
        />
      </View>
    </CameraPermissionGate>
  );
}
