import { describe } from "vitest";
import { S3StorageDriver, getS3Config } from "./storage/s3-storage.driver";
import { storageDriverScenarios } from "./storage/storage-driver.scenarios";

const config = getS3Config();

/**
 * The same storage scenarios as the local driver (us-ops-27.test.ts),
 * against a real S3-compatible store: S3Mock in CI, or any store `S3_*`
 * points at locally. Skipped when `S3_ENDPOINT` isn't set.
 */
describe.skipIf(!config)("US-OPS-27 · s3 driver (requires S3_ENDPOINT)", () => {
  const driver = new S3StorageDriver(config!);
  storageDriverScenarios(() => driver);
});
