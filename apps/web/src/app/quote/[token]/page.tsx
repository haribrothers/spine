import type { Metadata } from "next";
import { PublicQuoteView } from "./public-quote-view";
import { t } from "../../../lib/i18n";

export const metadata: Metadata = {
  title: t("publicQuote.metaTitle"),
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
    // `globals.css` sets `html, body { height: 100%; overflow: hidden }`
    // globally — a deliberate choice for the authenticated app, whose
    // AppShell owns its own internal scroll region (see AppShell's `main`,
    // `overflow-y-auto`) while the outer chrome stays fixed. This public
    // page isn't inside that shell and has no internal scroll region of
    // its own, so it inherited a non-scrollable `body` with content taller
    // than the viewport — fixed by overriding back to a normal scrolling
    // page, scoped to this route only via `fixed inset-0` + its own
    // `overflow-y-auto`, rather than touching the global rule the rest of
    // the app depends on.
    <div className="fixed inset-0 overflow-y-auto bg-surface">
      <PublicQuoteView token={token} />
    </div>
  );
}
