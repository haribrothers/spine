import { useLocalSearchParams } from "expo-router";
import { MeetingScreen } from "../../../../src/features/meetings/meeting-screen";

export default function Meeting() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MeetingScreen id={id} />;
}
