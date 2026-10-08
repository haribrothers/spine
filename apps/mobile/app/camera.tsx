import { useLocalSearchParams } from "expo-router";
import { CameraScreen, type CameraMode } from "../src/features/camera/camera-screen";

export default function Camera() {
  const { mode, jobId, request } = useLocalSearchParams<{ mode?: CameraMode; jobId?: string; request?: string }>();
  return <CameraScreen mode={mode ?? "photos"} jobId={jobId} request={request} />;
}
