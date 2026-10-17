"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AI_UNAVAILABLE_MESSAGE } from "@spine/shared";
import { ApiError } from "./api-client";

export type AiRequestState = { status: "idle" } | { status: "working" } | { status: "failed"; message: string; canRetry: boolean };

/**
 * US-AI-07 — what an AI control shows after a request that didn't work:
 * a paused budget, too many requests, a feature switched off, or a file AI
 * can't read (US-AI-08) say so in their own words; anything else is "AI
 * didn't answer…", with "Try again".
 */
export function aiFailure(err: unknown): { message: string; canRetry: boolean } {
  if (err instanceof ApiError && [400, 403, 404, 409, 413, 415, 422, 429].includes(err.status)) return { message: err.message, canRetry: false };
  return { message: AI_UNAVAILABLE_MESSAGE, canRetry: true };
}

/**
 * US-AI-07 — one AI control's request. `run(ask, onAnswer)` starts it
 * (aborting any before it); `onAnswer` gets the reply only if it wasn't
 * cancelled, so it can fill what's still empty at that moment. `cancel()`
 * stops it and fills nothing; `retry()` asks again. The form around it is
 * never blocked — nothing here disables it or touches what's typed.
 */
export function useAiRequest<T>() {
  const [state, setState] = useState<AiRequestState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);
  const last = useRef<{ ask: (signal: AbortSignal) => Promise<T>; onAnswer: (value: T) => void } | null>(null);

  const run = useCallback(async (ask: (signal: AbortSignal) => Promise<T>, onAnswer: (value: T) => void) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    last.current = { ask, onAnswer };
    setState({ status: "working" });
    try {
      const value = await ask(current.signal);
      if (current.signal.aborted) return;
      controller.current = null;
      setState({ status: "idle" });
      onAnswer(value);
    } catch (err) {
      if (current.signal.aborted) return;
      controller.current = null;
      setState({ status: "failed", ...aiFailure(err) });
    }
  }, []);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: "idle" });
  }, []);

  const retry = useCallback(() => {
    if (last.current) void run(last.current.ask, last.current.onAnswer);
  }, [run]);

  // Leaving the page drops a request still running.
  useEffect(() => () => controller.current?.abort(), []);

  return { state, working: state.status === "working", run, cancel, retry };
}
