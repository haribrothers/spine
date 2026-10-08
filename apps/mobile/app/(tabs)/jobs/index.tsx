import { PlannedTab } from "../../../src/components/planned-tab";

/** Built in Phase 5's later groups (D-196); until then the tab says what it will hold. */
export default function JobsScreen() {
  return <PlannedTab icon="briefcase" title="Jobs" description="Every job you're on the crew for, with its address, contact and milestones." />;
}
