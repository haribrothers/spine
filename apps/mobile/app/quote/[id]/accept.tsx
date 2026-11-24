import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { presentation } from "../../../src/lib/data/quotes";
import { AcceptScreen } from "../../../src/features/quotes/accept-screen";

export default function AcceptQuote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const quote = presentation.get(id)?.quote;
  useEffect(() => {
    if (!quote) router.back();
  }, [quote, router]);
  if (!quote) return null;
  return <AcceptScreen quote={quote} onBack={() => router.back()} onAccepted={() => router.replace(`/quote/${id}/accepted`)} />;
}
