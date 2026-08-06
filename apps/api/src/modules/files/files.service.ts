import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { files } from "../../db/schema";
import { getS3Client, getS3Config } from "./s3-client";

export interface UploadFileInput {
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
  uploadedByUserId: string | null;
}

/**
 * Owns all S3/MinIO interaction plus the `files` table row. Every method
 * that needs the object-storage client checks `getS3Client()` for `null`
 * first and throws a clear `ServiceUnavailableException` (503) rather than
 * letting an undefined-client call crash — per CLAUDE.md's graceful-
 * degradation rule, this must degrade the *file* feature, not the process.
 */
@Injectable()
export class FilesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  isStorageConfigured(): boolean {
    return getS3Client() !== null;
  }

  /**
   * MinIO (unlike a real AWS account) starts with zero buckets — nothing in
   * `docker-compose.dev.yml` or the prod compose file provisions the
   * `spine` bucket automatically. Rather than requiring an undocumented
   * manual `mc mb` step on every fresh environment (dev, a self-hosted
   * prod install, CI), the first upload self-heals: `HeadBucket` checks
   * existence, `CreateBucket` only runs on a 404. Cached in-process after
   * the first successful check/create so steady-state uploads don't pay an
   * extra round-trip per request.
   */
  private bucketEnsured = false;
  private async ensureBucket(client: S3Client, bucket: string) {
    if (this.bucketEnsured) return;
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    this.bucketEnsured = true;
  }

  async upload(orgId: string, input: UploadFileInput) {
    const client = getS3Client();
    const config = getS3Config();
    if (!client || !config) {
      throw new ServiceUnavailableException(
        "File storage is not configured on this server — attachments are unavailable.",
      );
    }
    await this.ensureBucket(client, config.bucket);

    const id = randomUUID();
    // Scoped per-org purely for readability in a bucket browser; org
    // isolation itself is enforced by the `orgId` column, not this path.
    const key = `${orgId}/${id}/${input.originalFilename}`;

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );

    const [row] = await this.db
      .insert(files)
      .values({
        id,
        orgId,
        key,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.byteLength,
        uploadedByUserId: input.uploadedByUserId,
      })
      .returning();
    return row;
  }

  async getMetadata(orgId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.orgId, orgId), eq(files.id, id)));
    if (!row) {
      throw new NotFoundException("File not found");
    }
    return row;
  }

  /**
   * A short-lived signed GET URL rather than a proxy stream. This is a
   * single-host, self-hosted deployment (docker/Caddyfile reverse-proxies
   * `api`/`web` under one origin, MinIO/S3 is its own service on its own
   * port) — MinIO already speaks HTTP directly and a signed URL means the
   * API process never has to buffer/stream file bytes through itself,
   * which would otherwise burn a request-handling thread per download for
   * no benefit here (no per-download authorization logic beyond "does this
   * file belong to my org," which the signed URL's short expiry plus this
   * org-scoped lookup already covers). A proxy-stream approach would only
   * be preferable if MinIO were not reachable from the browser at all
   * (e.g. a private network); this dev/self-hosted stack exposes MinIO's
   * port directly (docker-compose.dev.yml, `.env.example`), so that's not
   * the case here.
   */
  async getSignedUrl(orgId: string, id: string): Promise<{ url: string; file: typeof files.$inferSelect }> {
    const client = getS3Client();
    const config = getS3Config();
    if (!client || !config) {
      throw new ServiceUnavailableException(
        "File storage is not configured on this server — attachments are unavailable.",
      );
    }
    const file = await this.getMetadata(orgId, id);
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: config.bucket, Key: file.key }),
      { expiresIn: 300 },
    );
    return { url, file };
  }
}
