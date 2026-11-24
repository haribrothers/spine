"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, Button, FormField, Input, Spinner } from "@spine/ui";
import { AuthFrame, AuthHeading } from "../../components/auth-frame";
import { requestResetLink } from "../../lib/password-reset";
import { useT } from "../../lib/i18n";

/** US-AUTH-09 — ask for a reset link. The same page whether or not email (SMTP) is set up (D-084). */
export default function ForgotPasswordPage() {
  const t = useT();
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
      <AuthHeading title={t("auth.forgotPassword.title")}>{t("auth.forgotPassword.body")}</AuthHeading>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        {error && (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FormField label={t("auth.fields.email")} required>
          {(field) => <Input {...field} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </FormField>
        <Button type="submit" size="touch" disabled={loading} className="mt-1">
          {loading ? <Spinner size="sm" /> : t("auth.forgotPassword.send")}
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-on-surface-muted">{t("auth.forgotPassword.expires")}</p>
      <p className="mt-2 text-center text-[13px]">
        <Link href="/login" className="text-primary hover:underline">
          {t("auth.actions.backToLogIn")}
        </Link>
      </p>
    </AuthFrame>
  );
}
