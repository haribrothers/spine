import { useLocalSearchParams } from "expo-router";
import { FixScreen } from "../../../src/features/sync/fix-screen";

export default function Fix() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FixScreen id={id} />;
}
