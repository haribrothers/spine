import { useSignedInSession } from "../session/session-provider";
import { DEFAULT_FORMAT, type BusinessFormat } from "../format";

/** The business currency and locale for formatting (from the signed-in member). */
export function useBusinessFormat(): BusinessFormat {
  const { member } = useSignedInSession();
  return { currency: member.currency ?? DEFAULT_FORMAT.currency, locale: member.locale ?? DEFAULT_FORMAT.locale };
}
