import { useLocalSearchParams } from "expo-router";
import { PresentScreen } from "../../../src/features/quotes/present-screen";
import { useCloseQuote } from "../../../src/features/quotes/use-close-quote";

export default function PresentQuote() {
  const { id, jobId } = useLocalSearchParams<{ id: string; jobId?: string }>();
  const close = useCloseQuote(id);
  return <PresentScreen id={id} jobId={jobId} onClose={close} />;
}
