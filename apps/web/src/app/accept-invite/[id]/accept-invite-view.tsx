"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { authClient } from "../../../lib/auth-client";
import { ThemeToggle } from "../../../components/theme-toggle";

interface InvitationInfo {
  id: string;
  email: string;
  role: string;
  organizationName: string;
  organizationSlug: string;
  inviterEmail: string;
}

interface PublicInvitationPreview {
  email: string;
  role: string;
  organizationName: string;
}

/**
 * PRD S-10.2/§2.1 — the other half of sending an invite. Better Auth's
 * getInvitation/acceptInvitation both REQUIRE an existing session whose
 * email matches the invitation's email (they don't create an account) —
 * see auth.ts's sendInvitationEmail comment and this component's own
 * state machine below: no session -> prompt sign up/log in with the
 * invited email locked; session with the wrong email -> explain and offer
 * to sign out; session matching -> show the invite and accept/decline.
 */
export function AcceptInviteView({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingInvitation, setLoadingInvitation] = useState(false);
  const [acting, setActing] = useState<"accept" | "reject" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Pre-auth-only: Better Auth's own getInvitation requires a session
  // matching the invited email (see this file's header comment) so it
  // can't be used to pre-fill the signup form. This hits our own
  // /public/invitations/:id instead, which exposes just the email/role/org
  // name for a still-pending invitation — no session required, same trust
  // model as a public quote-acceptance link.
  const [preview, setPreview] = useState<PublicInvitationPreview | null>(null);

  const sessionEmail = session?.user?.email?.toLowerCase();

  useEffect(() => {
    if (sessionLoading || session) return;
    apiClient
      .get<PublicInvitationPreview>(`/public/invitations/${invitationId}`)
      .then(setPreview)
      .catch(() => {
        // No preview available (expired/invalid) — NeedsAccountPrompt falls
        // back to an unlocked email field rather than blocking sign up.
      });
  }, [invitationId, session, sessionLoading]);

  useEffect(() => {
    if (sessionLoading || !session) return;
    setLoadingInvitation(true);
    setLoadError(null);
    authClient.organization
      .getInvitation({ query: { id: invitationId } })
      .then(({ data, error }) => {
        if (error) {
          setLoadError(error.message ?? "This invitation could not be found or has expired.");
          return;
        }
        setInvitation(data as InvitationInfo);
      })
      .finally(() => setLoadingInvitation(false));
  }, [invitationId, session, sessionLoading]);

  async function handleAccept() {
    setActing("accept");
    setActionError(null);
    const { error } = await authClient.organization.acceptInvitation({ invitationId });
    setActing(null);
    if (error) {
      setActionError(error.message ?? "Could not accept the invitation.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleReject() {
    setActing("reject");
    setActionError(null);
    const { error } = await authClient.organization.rejectInvitation({ invitationId });
    setActing(null);
    if (error) {
      setActionError(error.message ?? "Could not decline the invitation.");
      return;
    }
    router.push("/login");
  }

  const emailMismatch = Boolean(session && invitation && sessionEmail !== invitation.email.toLowerCase());

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex w-full max-w-sm items-center justify-center">
        <Image src="/spine-logo-horizontal.png" alt="Spine" width={140} height={41} priority className="dark:hidden" />
        <Image
          src="/spine-logo-horizontal-light.png"
          alt="Spine"
          width={140}
          height={41}
          priority
          className="hidden dark:block"
        />
      </div>
      <ThemeToggle />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>You&apos;ve been invited</CardTitle>
          <CardDescription>Join an organisation on Spine.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {sessionLoading ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : !session ? (
            <NeedsAccountPrompt invitationId={invitationId} email={preview?.email} />
          ) : loadingInvitation ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : loadError ? (
            <Alert variant="critical">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : emailMismatch && invitation ? (
            <>
              <Alert variant="critical">
                <AlertDescription>
                  This invitation was sent to {invitation.email}, but you&apos;re signed in as {session.user.email}.
                  Sign out and sign in with the invited email to accept it.
                </AlertDescription>
              </Alert>
              <Button
                variant="secondary"
                onClick={async () => {
                  await authClient.signOut();
                  router.push(`/login`);
                }}
              >
                Sign out
              </Button>
            </>
          ) : invitation ? (
            <>
              {actionError && (
                <Alert variant="critical">
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}
              <p className="text-[13px] text-on-surface">
                <strong>{invitation.inviterEmail}</strong> invited you to join{" "}
                <strong>{invitation.organizationName}</strong> as <strong>{invitation.role}</strong>.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleAccept} disabled={acting !== null} className="flex-1">
                  {acting === "accept" ? <Spinner size="sm" /> : "Accept"}
                </Button>
                <Button variant="secondary" onClick={handleReject} disabled={acting !== null} className="flex-1">
                  {acting === "reject" ? <Spinner size="sm" /> : "Decline"}
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

function NeedsAccountPrompt({ invitationId, email }: { invitationId: string; email?: string }) {
  const signupHref = email
    ? `/signup?inviteId=${invitationId}&email=${encodeURIComponent(email)}`
    : `/signup?inviteId=${invitationId}`;
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <p className="text-on-surface">
        {email ? (
          <>
            Sign in or create an account as <strong>{email}</strong> to accept this invitation.
          </>
        ) : (
          "Sign in or create an account with the email this invitation was sent to."
        )}
      </p>
      <div className="flex gap-2">
        <Link href={signupHref} className="flex-1">
          <Button className="w-full">Create account</Button>
        </Link>
        <Link href={`/login?next=/accept-invite/${invitationId}`} className="flex-1">
          <Button variant="secondary" className="w-full">
            Log in
          </Button>
        </Link>
      </div>
    </div>
  );
}
