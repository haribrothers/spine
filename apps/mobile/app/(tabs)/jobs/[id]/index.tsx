import { useLocalSearchParams } from "expo-router";
import { JobDetailScreen } from "../../../../src/features/jobs/job-detail-screen";

export default function Job() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <JobDetailScreen id={id} />;
}
