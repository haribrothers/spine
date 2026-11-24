import { notFound, redirect } from "next/navigation";
import { getSession } from "../../../lib/get-session";

/**
 * US-OPS-11 — any address no page matches. Signed out, it's the login page
 * first (and back here after); signed in, the 404 page inside the app shell.
 */
export default async function MissingPage({ params }: { params: Promise<{ missing: string[] }> }) {
  const { missing } = await params;
  if (!(await getSession())) redirect(`/login?next=${encodeURIComponent(`/${missing.join("/")}`)}`);
  notFound();
}
