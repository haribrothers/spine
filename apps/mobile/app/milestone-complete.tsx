import { useLocalSearchParams } from "expo-router";
import { MilestoneCompleteScreen } from "../src/features/jobs/milestone-complete-screen";

export default function MilestoneComplete() {
  const { jobId, milestoneId } = useLocalSearchParams<{ jobId: string; milestoneId: string }>();
  return <MilestoneCompleteScreen jobId={jobId} milestoneId={milestoneId} />;
}
