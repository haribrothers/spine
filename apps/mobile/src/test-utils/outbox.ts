import { outbox } from "../lib/outbox/outbox";
import type { LocalFiles } from "../lib/outbox/local-files";
import type { ExpensePayload, LocalPhoto } from "../lib/outbox/types";

/** Photos "kept" in tests are just their URIs; discarding records them. */
export const discardedFiles: string[] = [];
export const testFiles: LocalFiles = {
  keepPhoto: async (uri, options = {}) => ({ uri, name: options.name ?? "photo.jpg", mimeType: "image/jpeg", size: 1_200_000 }),
  discard: (photo) => void discardedFiles.push(photo.uri),
  exists: (photo) => !missingFiles.has(photo.uri),
  formData: (photo) => {
    const form = new FormData();
    form.append("file", photo.uri);
    return form;
  },
};

/** URIs the fake phone has lost. */
export const missingFiles = new Set<string>();

export function photo(n: number, overrides: Partial<LocalPhoto> = {}): LocalPhoto {
  return { uri: `file:///outbox/photo-${n}.jpg`, name: `photo-${n}.jpg`, mimeType: "image/jpeg", size: 1_200_000, ...overrides };
}

export function queuePhotos(jobId = "job-marina", jobName = "Marina office fit-out", count = 2) {
  return outbox.addPhotos({ jobId, jobName, photos: Array.from({ length: count }, (_, i) => photo(i)) });
}

export const FUEL: ExpensePayload = {
  categoryId: "cat-fuel",
  categoryName: "Fuel & Vehicle",
  jobId: "job-marina",
  jobName: "Marina office fit-out",
  date: "2026-10-08",
  amount: "6420",
  currency: "USD",
  description: "Van fuel",
  paidBy: "employee",
  receipt: { uri: "file:///outbox/receipt.jpg", name: "receipt.jpg", mimeType: "image/jpeg", size: 900_000 },
};

export function queueExpense(overrides: Partial<ExpensePayload> = {}) {
  return outbox.addExpense({ ...FUEL, ...overrides });
}

export function queueCompletion(jobId = "job-townhomes", milestoneId = "m-9") {
  return outbox.addCompletion({ jobId, jobName: "Phase 2 townhomes — foundations", milestoneId, milestoneName: "Foundation walls poured", completionNotes: null, photos: [] });
}
