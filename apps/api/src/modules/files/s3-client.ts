import { S3Client } from "@aws-sdk/client-s3";

/**
 * S3-compatible client wrapper — MinIO in dev/self-hosted, any S3-compatible
 * provider in prod. `@aws-sdk/client-s3` is the standard choice: MinIO
 * implements the S3 API directly, so no separate MinIO SDK is needed.
 *
 * Per CLAUDE.md's graceful-degradation rule ("if object storage is down,
 * the app runs read-only for attachments rather than failing globally")
 * and the 3-required-env-vars boot contract (`DATABASE_URL`, `AUTH_SECRET`,
 * `APP_URL` — S3_* is never in that list), this must never throw at import
 * or boot time when S3 is unconfigured. `getS3Client()` returns `null` when
 * `S3_ENDPOINT` is unset, and every file-serving code path (FilesService)
 * checks for that and returns a clear "attachments unavailable" error
 * instead of crashing.
 */
export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getS3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) {
    return null;
  }
  return {
    endpoint,
    bucket: process.env.S3_BUCKET ?? "spine",
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  };
}

let cachedClient: S3Client | null | undefined;

/**
 * Lazily builds and caches a single S3Client for the process lifetime, or
 * `null` if S3 is unconfigured. `forcePathStyle: true` is required for
 * MinIO (and most self-hosted S3-compatible stores) since they don't
 * support virtual-hosted-style bucket addressing (`bucket.endpoint.com`)
 * the AWS SDK defaults to.
 */
export function getS3Client(): S3Client | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }
  const config = getS3Config();
  if (!config) {
    cachedClient = null;
    return null;
  }
  cachedClient = new S3Client({
    endpoint: config.endpoint,
    region: "us-east-1", // MinIO ignores region but the SDK requires a value.
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return cachedClient;
}
