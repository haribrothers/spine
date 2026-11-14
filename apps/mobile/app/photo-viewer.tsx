import { useLocalSearchParams } from "expo-router";
import { PhotoViewerScreen } from "../src/features/jobs/photo-viewer-screen";

/** US-MOB-30 — a job's photos full screen, opened from a photo on the job or its Photos screen. */
export default function PhotoViewer() {
  const { jobId, key } = useLocalSearchParams<{ jobId: string; key: string }>();
  return <PhotoViewerScreen jobId={jobId} startKey={key ?? ""} />;
}
