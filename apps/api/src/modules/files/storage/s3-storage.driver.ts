import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import { type ByteRange, type StorageDriver, StoredObjectExistsError, StoredObjectMissingError } from "./storage-driver";

export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

/** `null` when `S3_ENDPOINT` is unset — S3 is optional and never required to boot. */
export function getS3Config(env: NodeJS.ProcessEnv = process.env): S3Config | null {
  const endpoint = env.S3_ENDPOINT;
  if (!endpoint) return null;
  return {
    endpoint,
    bucket: env.S3_BUCKET || "spine",
    accessKeyId: env.S3_ACCESS_KEY ?? "",
    secretAccessKey: env.S3_SECRET_KEY ?? "",
    // Self-hosted stores ignore the region, but the SDK requires one.
    region: env.S3_REGION || "us-east-1",
  };
}

/**
 * The optional driver (`STORAGE_DRIVER=s3`): AWS S3, Cloudflare R2,
 * Backblaze B2 or a self-hosted store such as RustFS (D-102, D-103).
 * `forcePathStyle` because self-hosted stores don't do bucket subdomains.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = "s3" as const;
  private readonly client: S3Client;
  private bucketEnsured = false;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async save(key: string, data: Buffer | Readable, contentType: string): Promise<void> {
    await this.ensureBucket();
    // Write-once. Not atomic with the PUT (conditional writes aren't supported
    // by every S3-compatible store), but keys are fresh ids, so this only
    // guards against a code path trying to overwrite an existing file.
    if (await this.exists(key)) throw new StoredObjectExistsError(key);
    // A PUT is all-or-nothing on S3: an interrupted upload never becomes a readable object.
    const body = Buffer.isBuffer(data) ? data : await streamToBuffer(data);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async openReadStream(key: string, range?: ByteRange): Promise<Readable> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Range: range ? `bytes=${range.start}-${range.end}` : undefined,
        }),
      );
      if (!(result.Body instanceof Readable)) throw new Error(`S3 returned no body for ${key}`);
      return result.Body;
    } catch (err) {
      if (isNotFound(err)) throw new StoredObjectMissingError(key);
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return true;
    } catch (err) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }

  presignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.config.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  /** Self-hosted stores start with no buckets; the first save creates it instead of needing a manual step. */
  private async ensureBucket(): Promise<void> {
    if (this.bucketEnsured) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
    }
    this.bucketEnsured = true;
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

/** GetObject throws `NoSuchKey`, HeadObject `NotFound`; some stores only set the 404 status. */
function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404;
}
