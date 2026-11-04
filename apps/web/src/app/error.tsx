"use client";

import { ServerErrorView } from "../components/server-error-view";

/** US-OPS-13 — any page (and the signed-in layout) that fails to load. */
export default function AppError({ error }: { error: Error & { digest?: string } }) {
  return <ServerErrorView error={error} />;
}
