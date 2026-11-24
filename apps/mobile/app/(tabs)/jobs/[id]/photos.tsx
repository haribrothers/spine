import { useLocalSearchParams } from "expo-router";
import { JobPhotosScreen } from "../../../../src/features/jobs/job-photos-screen";

export default function JobPhotos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <JobPhotosScreen id={id} />;
}
