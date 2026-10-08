import { OfflineError, UpdateRequiredError } from "../api/errors";
import { outbox as defaultOutbox, type Outbox } from "./outbox";
import { classify, PausedError, sendItem, type Transport } from "./send";
import type { OutboxItem } from "./types";

/** Why nothing is going out right now, for the Sync screen's reason line (US-MOB-08). */
export type SyncProblem = "offline" | "unreachable" | "updateRequired" | "signedOut" | null;

export interface SyncState {
  sending: boolean;
  problem: SyncProblem;
}

/** 5 s, 10 s, 20 s … at most 5 minutes between tries of one item (US-MOB-09). */
export function backoffMs(attempts: number): number {
  return Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attempts - 1));
}

/**
 * Sends the outbox, oldest item first, one at a time. Runs when something
 * is queued, when the phone comes back online or to the foreground, and on
 * "Try sending now" (which ignores back-off). A network failure stops the
 * run (everything else would fail too) and the item waits its back-off; a
 * refusal marks that item failed and the run goes on.
 */
export class SyncEngine {
  private transport: Transport | null = null;
  private state: SyncState = { sending: false, problem: null };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;

  constructor(
    private queue: Outbox = defaultOutbox,
    private now: () => number = Date.now,
  ) {}

  snapshot = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** The signed-in session's request, or null when signed out. */
  setTransport(transport: Transport | null) {
    this.transport = transport;
    if (!transport) {
      this.clearTimer();
      this.setState({ sending: false, problem: "signedOut" });
    } else if (this.state.problem === "signedOut") {
      this.setState({ problem: null });
    }
  }

  /** The phone's connection changed: going offline says so; coming back sends at once (US-MOB-07). */
  setOnline(online: boolean) {
    if (!online) this.setState({ problem: "offline" });
    else {
      if (this.state.problem === "offline") this.setState({ problem: null });
      void this.run({ force: true });
    }
  }

  /** Sends what's due; `force` also sends items still in back-off ("Try sending now"). */
  run(options: { force?: boolean } = {}): Promise<void> {
    if (this.running) {
      this.again ||= Boolean(options.force);
      return this.running;
    }
    this.running = this.loop(Boolean(options.force)).finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        void this.run({ force: true });
      } else this.schedule();
    });
    return this.running;
  }

  private async loop(force: boolean) {
    await this.queue.ready();
    const transport = this.transport;
    if (!transport) return;
    const tried = new Set<string>();
    for (;;) {
      const item = this.queue
        .snapshot()
        .find((candidate) => candidate.status === "waiting" && !tried.has(candidate.id) && (force || (candidate.nextAttemptAt ?? 0) <= this.now()));
      if (!item) break;
      tried.add(item.id);
      this.setState({ sending: true });
      await this.queue.update(item.id, { status: "sending" });
      try {
        const sent = await sendItem(item, transport, async (progress) => void (await this.queue.update(item.id, { payload: progress.payload } as Partial<OutboxItem>)));
        await this.queue.update(item.id, { ...sent, status: "sent", sentAt: this.now(), error: null, nextAttemptAt: null } as Partial<OutboxItem>);
        const done = this.queue.get(item.id);
        if (done) this.queue.discardFiles(done);
        if (this.state.problem !== "offline") this.setState({ problem: null });
      } catch (error) {
        const kind = classify(error);
        if (kind === "rejected") {
          await this.queue.update(item.id, { status: "failed", error: (error as Error).message, nextAttemptAt: null });
          continue;
        }
        const attempts = item.attempts + 1;
        await this.queue.update(item.id, { status: "waiting", attempts, nextAttemptAt: this.now() + backoffMs(attempts) });
        if (kind === "paused") {
          const update = error instanceof UpdateRequiredError || (error instanceof PausedError && error.reason === "updateRequired");
          this.setState({ problem: update ? "updateRequired" : "signedOut" });
        }
        else this.setState({ problem: error instanceof OfflineError ? "offline" : "unreachable" });
        break;
      }
    }
    this.setState({ sending: false });
  }

  /** Wakes up for the next item whose back-off ends. */
  private schedule() {
    this.clearTimer();
    if (!this.transport || this.state.problem === "updateRequired") return;
    const next = this.queue
      .snapshot()
      .filter((item) => item.status === "waiting")
      .map((item) => item.nextAttemptAt ?? this.now())
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    this.timer = setTimeout(() => void this.run(), Math.max(0, next - this.now()));
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Puts a fixed item back in line and sends it now (US-MOB-09 "Send again"). */
  async resend(id: string): Promise<void> {
    await this.queue.update(id, { status: "waiting", error: null, attempts: 0, nextAttemptAt: null });
    await this.run({ force: true });
  }

  private setState(patch: Partial<SyncState>) {
    const next = { ...this.state, ...patch };
    if (next.sending === this.state.sending && next.problem === this.state.problem) return;
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }

  /** Tests. */
  stop() {
    this.clearTimer();
  }
}

export const syncEngine = new SyncEngine();
