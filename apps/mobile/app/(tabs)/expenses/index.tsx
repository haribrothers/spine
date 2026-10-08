import { PlannedTab } from "../../../src/components/planned-tab";

/** Built in Phase 5's later groups (D-196); until then the tab says what it will hold. */
export default function ExpensesScreen() {
  return <PlannedTab icon="receipt" title="Expenses" description="The expenses you've submitted and what's happened to them." />;
}
