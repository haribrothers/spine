"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Alert, AlertDescription, Button, Card, CardContent, CardHeader, CardTitle } from "@spine/ui";
import { AuthPageShell } from "../../../components/auth-page-shell";
import { formatCountdown, readResetRequest, requestResetLink, RESEND_AFTER_SECONDS, type ResetRequest } from "../../../lib/password-reset";

/** US-AUTH-09 — "Check your email", with a resend button that waits 60 seconds. */
export default function ForgotPasswordSentPage() {
  const router = useRouter();
  const [request, setRequest] = useState<ResetRequest | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const saved = readResetRequest();
    if (!saved) {
      router.replace("/forgot-password");
      return;
    }
    setRequest(saved);
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!request) return null;

  const remaining = RESEND_AFTER_SECONDS - (now - request.sentAt) / 1000;
  const waiting = remaining > 0;

  async function resend() {
    if (!request) return;
    setError(null);
    setSending(true);
    const failure = await requestResetLink(request.email);
    setSending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setRequest(readResetRequest() ?? { email: request.email, sentAt: Date.now() });
    setNow(Date.now());
  }

  return (
    <AuthPageShell>
      <Card className="w-full max-w-sm" data-testid="forgot-password-sent">
        <CardHeader>
          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-info-bg text-info" aria-hidden="true">
            <Mail size={18} />
          </span>
          <CardTitle>Check your email</CardTitle>
          <p className="text-[13px] text-on-surface-muted">
            If an account exists for <strong className="font-semibold text-on-surface">{request.email}</strong>, we&apos;ve sent a link to reset its
            password. The link works once and expires in 1 hour.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button variant="secondary" disabled={waiting || sending} onClick={resend}>
            {waiting ? `Resend link in ${formatCountdown(remaining)}` : "Resend link"}
          </Button>
          <p className="text-center text-[13px]">
            <Link href="/login" className="text-primary hover:underline">
              Back to log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}
