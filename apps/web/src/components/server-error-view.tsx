"use client";

import { useEffect, useState } from "react";
import { Button, SpineLogo } from "@spine/ui";

export const SERVER_ERROR_TITLE = "Something went wrong on our side";
export const SERVER_ERROR_MESSAGE =
  "Spine couldn't finish loading this page. Nothing you entered was lost — anything you saved is still saved. Try again in a minute; if it keeps happening, send the error reference below to the person who runs your Spine server.";

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
  const [reference, setReference] = useState<string | null>(null);
  useEffect(() => {
    setReference(errorReference(error, new Date()));
    console.error(error);
  }, [error]);

  return (
    <main data-testid="server-error" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <SpineLogo variant="horizontal" size={130} />
      <h1 className="text-[22px] font-semibold text-on-surface">{SERVER_ERROR_TITLE}</h1>
      <p className="max-w-[470px] text-[14px] text-on-surface-muted">{SERVER_ERROR_MESSAGE}</p>
      {reference && (
        <p className="rounded-sm bg-surface-sunken px-2.5 py-1 font-mono text-[12.5px] text-on-surface" data-testid="error-reference">
          Error reference: {reference}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.location.reload()}>Try again</Button>
        <Button variant="secondary" asChild>
          <a href="/dashboard">Go to dashboard</a>
        </Button>
      </div>
    </main>
  );
}
