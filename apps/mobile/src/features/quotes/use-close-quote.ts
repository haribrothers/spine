import { useCallback } from "react";
import { useNavigation, useRouter } from "expo-router";
import { presentation } from "../../lib/data/quotes";

/**
 * Closes the whole presentation (the `quote` modal and anything on it) and
 * goes back to the job — from the accepted screen or the decline sheet,
 * where "back" alone would return to the quote that was just answered.
 */
export function useCloseQuote(id: string) {
  const navigation = useNavigation();
  const router = useRouter();
  return useCallback(() => {
    presentation.end(id);
    const root = navigation.getParent();
    if (root?.canGoBack()) root.goBack();
    else router.back();
  }, [id, navigation, router]);
}
