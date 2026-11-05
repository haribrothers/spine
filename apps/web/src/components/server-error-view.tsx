"use client";

import { useEffect, useState } from "react";
import { Button, SpineLogo } from "@spine/ui";
import { t as translate, useT } from "../lib/i18n";

export const SERVER_ERROR_TITLE = translate("common.serverError.title");
export const SERVER_ERROR_MESSAGE = translate("common.serverError.message");

/**
 * The reference the person who runs the server can find in the logs: the
 * API's request id (US-OPS-07) when the API failed, else Next.js's digest
 * (logged with the server error), else the time it happened.
 */
export function errorReference(error: unknown, now: Date): string {
  const { requestId, digest } = (error ?? {}) as { requestId?: unknown; digest?: unknown };
  if (typeof requestId === "string" && requestId) return requestId;
  if (typeof digest === "string" && digest) return digest;
  return now.toISOString();
}

/**
 * US-OPS-13 (finding G8) — an unexpected error while loading a page. Says
 * saved work is safe and gives a reference to send. "Try again" reloads the
 * page; "Go to dashboard" is a full page load, out of the failed state.
 */
export function ServerErrorView({ error }: { error: unknown }) {
  const t = useT();
  const [reference, setReference] = useState<string | null>(null);
  useEffect(() => {
    setReference(errorReference(error, new Date()));
    console.error(error);
  }, [error]);

  return (
    <main data-testid="server-error" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <SpineLogo variant="horizontal" size={130} />
      <h1 className="text-[22px] font-semibold text-on-surface">{t("common.serverError.title")}</h1>
      <p className="max-w-[470px] text-[14px] text-on-surface-muted">{t("common.serverError.message")}</p>
      {reference && (
        <p className="rounded-sm bg-surface-sunken px-2.5 py-1 font-mono text-[12.5px] text-on-surface" data-testid="error-reference">
          {t("common.serverError.reference", { reference })}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.location.reload()}>{t("common.actions.tryAgain")}</Button>
        <Button variant="secondary" asChild>
          <a href="/dashboard">{t("common.actions.goToDashboard")}</a>
        </Button>
      </div>
    </main>
  );
}
