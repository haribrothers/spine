"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, Button, FormField, Input, Spinner } from "@spine/ui";
import { AuthFrame, AuthHeading } from "../../components/auth-frame";
import { requestResetLink } from "../../lib/password-reset";

/** US-AUTH-09 — ask for a reset link. The same page whether or not email (SMTP) is set up (D-084). */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const failure = await requestResetLink(email.trim());
    setLoading(false);
    if (failure) {
      setError(failure);
      return;
    }
    router.push("/forgot-password/sent");
  }

  return (
    <AuthFrame scene="login">
      <AuthHeading title="Reset your password">Enter the email you sign in with and we&apos;ll send you a link to choose a new password.</AuthHeading>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        {error && (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FormField label="Email" required>
          {(field) => <Input {...field} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </FormField>
        <Button type="submit" size="touch" disabled={loading} className="mt-1">
          {loading ? <Spinner size="sm" /> : "Send reset link"}
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-on-surface-muted">The link works once and expires in 1 hour.</p>
      <p className="mt-2 text-center text-[13px]">
        <Link href="/login" className="text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthFrame>
  );
}
