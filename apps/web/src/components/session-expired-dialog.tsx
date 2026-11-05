"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  FormField,
  Input,
  Spinner,
} from "@spine/ui";
import { SESSION_EXPIRED_EVENT } from "../lib/api-client";
import { authClient } from "../lib/auth-client";
import { loginUrlFor } from "../lib/safe-next";
import { useT } from "../lib/i18n";

/**
 * US-AUTH-12 — when the session ends:
 * - a save that gets 401 opens this dialog, and logging in happens inside
 *   it, so the page (and whatever was typed) never unloads. The save isn't
 *   retried; the user presses it again.
 * - a background read that gets 401 while nothing has been typed on this
 *   page goes to `/login?next=<this page>`. If something has been typed,
 *   it waits for the save to show the dialog instead of losing the draft.
 */
export function SessionExpiredDialog({ email }: { email: string }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"notice" | "login">("notice");
  const [emailInput, setEmailInput] = useState(email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const typed = useRef(false);
  const redirecting = useRef(false);
  const openRef = useRef(false);
  openRef.current = open;

  // Typing anywhere on the page marks it as having a draft.
  useEffect(() => {
    typed.current = false;
  }, [pathname]);
  useEffect(() => {
    const onInput = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-session-expired-dialog]")) return;
      typed.current = true;
    };
    document.addEventListener("input", onInput, true);
    return () => document.removeEventListener("input", onInput, true);
  }, []);

  useEffect(() => {
    const onExpired = (e: Event) => {
      const mutation = (e as CustomEvent<{ mutation: boolean }>).detail?.mutation ?? false;
      if (mutation) {
        if (!openRef.current) {
          setStep("notice");
          setPassword("");
          setError(null);
          setOpen(true);
        }
        return;
      }
      if (openRef.current || typed.current || redirecting.current) return;
      redirecting.current = true;
      window.location.assign(loginUrlFor(`${window.location.pathname}${window.location.search}`));
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  async function logIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await authClient.signIn.email({ email: email || emailInput, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? t("common.sessionExpired.passwordFailed"));
      return;
    }
    setPassword("");
    setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent data-session-expired-dialog data-testid="session-expired-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("common.sessionExpired.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("common.sessionExpired.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {step === "notice" ? (
          <AlertDialogFooter>
            <Button onClick={() => setStep("login")}>{t("common.sessionExpired.logInAgain")}</Button>
          </AlertDialogFooter>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={logIn}>
            {error && (
              <Alert variant="critical">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {email ? (
              <p className="text-[13px] text-on-surface">
                {t("common.sessionExpired.logInAs")}
                <strong>{email}</strong>
                {t("common.sessionExpired.logInAsEnd")}
              </p>
            ) : (
              <FormField label={t("common.sessionExpired.email")} required>
                {(field) => <Input {...field} type="email" autoComplete="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />}
              </FormField>
            )}
            <FormField label={t("common.sessionExpired.password")} required>
              {(field) => (
                <Input {...field} type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
            </FormField>
            <AlertDialogFooter>
              <Button type="submit" disabled={loading || !password}>
                {loading ? <Spinner size="sm" /> : t("common.sessionExpired.logIn")}
              </Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
