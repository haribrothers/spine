import { useEffect } from "react";
import { BackHandler } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { presentation } from "../../../src/lib/data/quotes";
import { AcceptedScreen } from "../../../src/features/quotes/accepted-screen";
import { useCloseQuote } from "../../../src/features/quotes/use-close-quote";

export default function QuoteAccepted() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const close = useCloseQuote(id);
  const answer = presentation.get(id)?.answer;
  // Android's back goes to the job too, never to the quote that's now locked.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);
  if (!answer) return null;
  return <AcceptedScreen quote={answer} onDone={close} />;
}
