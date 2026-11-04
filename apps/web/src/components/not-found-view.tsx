"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@spine/ui";

export const NOT_FOUND_TITLE = "We can't find that page";
export const NOT_FOUND_MESSAGE =
  "The link may be wrong, or the record may have been deleted. Financial documents are never deleted — if you followed a link to an invoice, check its number in Invoices.";

/**
 * US-OPS-11 (finding G8) — an unknown address, or a record that isn't in
 * this organisation. Shown inside the app shell (`(app)/not-found.tsx`), so
 * the navigation is still there.
 */
export function NotFoundView() {
  const router = useRouter();
  return (
    <div data-testid="not-found" className="mx-auto flex max-w-[480px] flex-col items-center gap-3 py-24 text-center">
      <p className="text-[13px] font-medium text-on-surface-muted">404</p>
      <h1 className="text-[22px] font-semibold text-on-surface">{NOT_FOUND_TITLE}</h1>
      <p className="text-[14px] text-on-surface-muted">{NOT_FOUND_MESSAGE}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    </div>
  );
}
