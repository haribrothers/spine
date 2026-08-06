import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spine/ui";
import { getSession } from "../../lib/get-session";
import { SetupChecklist } from "./setup-checklist";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "../../components/theme-toggle";

/**
 * Real landing page for the sign-up/login flow and for the onboarding
 * wizard's "finish"/"skip" actions. Middleware already redirects
 * unauthenticated requests to /login before this renders, but the session
 * is re-read here too so the page has real content to show rather than
 * trusting middleware alone. Deliberately does NOT redirect back into
 * /onboarding on every visit — onboarding is never a gate (CLAUDE.md), so a
 * returning user always lands here directly regardless of whether they
 * finished, skipped, or never started the wizard.
 */
export default async function DashboardPage() {
  const session = await getSession();

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-4 py-10">
      <div className="flex w-full max-w-md justify-end">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            You&apos;re signed in{session?.user?.name ? ` as ${session.user.name}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-on-surface-muted">Name</dt>
            <dd className="text-on-surface">{session?.user?.name ?? "—"}</dd>
            <dt className="text-on-surface-muted">Email</dt>
            <dd className="text-on-surface">{session?.user?.email ?? "—"}</dd>
          </dl>
          <SignOutButton />
        </CardContent>
      </Card>

      <SetupChecklist />
    </main>
  );
}
