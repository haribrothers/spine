import type { Metadata } from "next";
import { PublicQuoteView } from "./public-quote-view";

export const metadata: Metadata = {
  title: "Quote",
  // Public quote links contain a customer's own quote data — kept out of
  // search engine indexes, matching a "shared, not published" access model.
  robots: { index: false, follow: false },
};

/**
 * PRD F3 Stage 3 (S-03.5) — the public, unauthenticated landing page for a
 * quote's accept/reject link. Deliberately does NOT call
 * `apps/web/src/lib/get-session.ts` and does NOT render inside `AppLayout`
 * (see `apps/web/src/app/quotes/[id]/page.tsx` for how every authenticated
 * page composes those two) — this route has no session to read, and must
 * render correctly for a fully logged-out visitor. There is no root-level
 * auth middleware in this app (confirmed: `apps/web/src/app/layout.tsx` has
 * no gate, and every authenticated page opts in individually by calling
 * `getSession()` itself) — so simply never calling it here is sufficient to
 * keep this route public; nothing needs to be bypassed.
 *
 * All the real work — fetching `GET /public/quotes/:token`, rendering the
 * quote, and the accept/reject actions — lives in the client component
 * (`PublicQuoteView`), since the token-gated data is customer-specific and
 * must never be cached/shared across visitors at the Next.js route-segment
 * level.
 */
export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="min-h-screen overflow-y-auto bg-background">
      <PublicQuoteView token={token} />
    </div>
  );
}
