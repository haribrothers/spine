import { AsyncLocalStorage } from "node:async_hooks";

/** US-OPS-07 — the id of the request being handled, so every log line it causes carries it. */
const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export function runWithRequestId<T>(requestId: string, work: () => T): T {
  return requestContext.run({ requestId }, work);
}

export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
