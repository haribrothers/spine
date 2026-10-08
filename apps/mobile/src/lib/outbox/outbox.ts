import { newIdempotencyKey } from "../api/idempotency";
import { deviceFiles, type LocalFiles } from "./local-files";
import { memoryOutboxBackend, sqliteOutboxBackend, type OutboxBackend } from "./outbox-store";
import type { CompletionPayload, ExpensePayload, LocalPhoto, OutboxItem, PhotosPayload } from "./types";

type Listener = () => void;

function photosOf(item: OutboxItem): LocalPhoto[] {
  if (item.kind === "expense") return item.payload.receipt ? [item.payload.receipt] : [];
  return item.payload.photos;
}

function startOfToday(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * The phone's outbox: what's waiting to reach the office, in the order it
 * was made. Every change is written to SQLite before listeners hear of it.
 * Items belong to one person on one server (`claim`): a different person
 * signing in on this phone never sends someone else's photos.
 */
export class Outbox {
  private items: OutboxItem[] = [];
  private loading: Promise<void> | null = null;
  private listeners = new Set<Listener>();
  private addedListeners = new Set<Listener>();

  constructor(
    private backend: OutboxBackend,
    private files: LocalFiles,
  ) {}

  /** Tests: a fresh in-memory outbox. */
  reset(backend: OutboxBackend = memoryOutboxBackend(), files: LocalFiles = this.files) {
    this.backend = backend;
    this.files = files;
    this.items = [];
    this.loading = null;
    this.emit();
  }

  ready(): Promise<void> {
    return (this.loading ??= this.backend.load().then(({ items }) => {
      this.items = items.map((item) => (item.status === "sending" ? { ...item, status: "waiting" as const } : item));
      this.pruneSent();
      this.emit();
    }));
  }

  /** The items now, oldest first (a new array after every change, for `useSyncExternalStore`). */
  snapshot = (): readonly OutboxItem[] => this.items;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Called after something is queued, so sync starts at once. */
  onAdded(listener: Listener): () => void {
    this.addedListeners.add(listener);
    return () => this.addedListeners.delete(listener);
  }

  get(id: string): OutboxItem | undefined {
    return this.items.find((item) => item.id === id);
  }

  /** Keeps the outbox for `owner` ("<server>|<email>"); anyone else's items are discarded. */
  async claim(owner: string): Promise<void> {
    await this.ready();
    const { owner: current } = await this.backend.load();
    if (current && current !== owner) await this.discardAll();
    await this.backend.setOwner(owner);
  }

  addPhotos(payload: PhotosPayload) {
    return this.add({ kind: "photos", payload, result: null });
  }

  addExpense(payload: ExpensePayload) {
    return this.add({ kind: "expense", payload, result: null });
  }

  addCompletion(payload: CompletionPayload) {
    return this.add({ kind: "completion", payload, result: null });
  }

  private async add(fields: Pick<OutboxItem, "kind" | "payload" | "result">): Promise<OutboxItem> {
    await this.ready();
    const item = { ...fields, id: newIdempotencyKey(), status: "waiting", createdAt: Date.now(), attempts: 0, nextAttemptAt: null, error: null, sentAt: null } as OutboxItem;
    await this.backend.put(item);
    this.items = [...this.items, item];
    this.emit();
    this.addedListeners.forEach((listener) => listener());
    return item;
  }

  async update(id: string, patch: Partial<OutboxItem>): Promise<OutboxItem | undefined> {
    const current = this.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch } as OutboxItem;
    await this.backend.put(next);
    this.items = this.items.map((item) => (item.id === id ? next : item));
    this.emit();
    return next;
  }

  /** Deletes an item from the phone, with its photos (US-MOB-09 "Delete this expense"). */
  async remove(id: string): Promise<void> {
    const item = this.get(id);
    if (!item) return;
    photosOf(item).forEach((photo) => this.files.discard(photo));
    await this.backend.remove(id);
    this.items = this.items.filter((other) => other.id !== id);
    this.emit();
  }

  /** Sign-out or removed access: nothing of this person's stays on the phone (US-MOB-02). */
  async clear(): Promise<void> {
    await this.ready();
    await this.discardAll();
    await this.backend.setOwner(null);
  }

  private async discardAll() {
    this.items.forEach((item) => photosOf(item).forEach((photo) => this.files.discard(photo)));
    await this.backend.clear();
    this.items = [];
    this.emit();
  }

  /** "SENT TODAY" keeps today's sent items; older ones go. */
  private pruneSent(now: number = Date.now()) {
    const today = startOfToday(now);
    const old = this.items.filter((item) => item.status === "sent" && (item.sentAt ?? 0) < today);
    if (!old.length) return;
    old.forEach((item) => void this.backend.remove(item.id));
    this.items = this.items.filter((item) => !old.includes(item));
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  /** The files an item keeps on the phone. */
  photosOf = photosOf;

  /** Compresses and keeps a new photo for an item (D-053), through the same files the outbox uses. */
  keepPhoto(uri: string, options?: { name?: string; width?: number; height?: number }): Promise<LocalPhoto> {
    return this.files.keepPhoto(uri, options);
  }

  /** Deletes a photo kept for something never queued (closing the camera, removing a receipt). */
  discardPhoto(photo: LocalPhoto) {
    this.files.discard(photo);
  }

  /** A photo as the multipart body `POST /files` takes. */
  formData(photo: LocalPhoto): FormData {
    return this.files.formData(photo);
  }

  /** Whether a photo's copy is still on the phone. */
  hasFile(photo: LocalPhoto): boolean {
    return this.files.exists(photo);
  }

  /** Drops a sent item's local copies: the server has them now. */
  discardFiles(item: OutboxItem) {
    photosOf(item).forEach((photo) => this.files.discard(photo));
  }

  /** Replaces a failed expense's receipt (Fix: retake, choose, remove), deleting the old copy. */
  async setReceipt(id: string, receipt: LocalPhoto | null): Promise<void> {
    const item = this.get(id);
    if (!item || item.kind !== "expense") return;
    if (item.payload.receipt && item.payload.receipt.uri !== receipt?.uri) this.files.discard(item.payload.receipt);
    await this.update(id, { payload: { ...item.payload, receipt } } as Partial<OutboxItem>);
  }

  /** Removes one photo from a failed photos or completion item (Fix). */
  async removePhoto(id: string, uri: string): Promise<void> {
    const item = this.get(id);
    if (!item || item.kind === "expense") return;
    const photo = item.payload.photos.find((p) => p.uri === uri);
    if (photo) this.files.discard(photo);
    await this.update(id, { payload: { ...item.payload, photos: item.payload.photos.filter((p) => p.uri !== uri) } } as Partial<OutboxItem>);
  }
}

export const outbox = new Outbox(sqliteOutboxBackend(), deviceFiles);
