import type { Readable } from "node:stream";

export type StorageDriverName = "local" | "s3";

/** Inclusive byte range, as in an HTTP `Range: bytes=start-end` header. */
export interface ByteRange {
  start: number;
  end: number;
}

/** The stored object a `files` row points at doesn't exist in its driver. */
export class StoredObjectMissingError extends Error {
  constructor(key: string) {
    super(`Stored object ${key} is missing`);
    this.name = "StoredObjectMissingError";
  }
}

/** A save targeted a key that already holds a file. Stored files are write-once (D-104). */
export class StoredObjectExistsError extends Error {
  constructor(key: string) {
    super(`Stored object ${key} already exists and can't be replaced`);
    this.name = "StoredObjectExistsError";
  }
}

/**
 * Where file bytes live (D-102). `FilesService` owns the `files` rows and
 * every permission check; a driver only stores and returns bytes by key, so
 * nothing outside `FilesService` should ever call one directly.
 */
export interface StorageDriver {
  readonly name: StorageDriverName;
  /**
   * Stores the whole object or nothing: a failed save never leaves a readable
   * partial object. Write-once: throws `StoredObjectExistsError` if the key
   * already holds a file, so an issued document's bytes can't be replaced.
   */
  save(key: string, data: Buffer | Readable, contentType: string): Promise<void>;
  /** Throws `StoredObjectMissingError` when the key doesn't exist. */
  openReadStream(key: string, range?: ByteRange): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** `s3` only: a presigned GET URL, so the bytes don't stream through the API. */
  presignedUrl?(
    key: string,
    expiresInSeconds: number,
    response?: { contentType?: string; contentDisposition?: string },
  ): Promise<string>;
}

/**
 * The storage key for a new file. Built only from ids — never from the
 * uploaded name (D-104) — with a 2-character prefix folder so no single
 * directory grows past a few thousand entries.
 */
export function fileKey(orgId: string, fileId: string): string {
  return `${orgId}/${fileId.slice(0, 2)}/${fileId}`;
}
