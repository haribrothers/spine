import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, Page } from "@playwright/test";
import { DEMO_FIELD_USER, logIn } from "./fixtures";
import { api, isoDays } from "./quote-seed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

/** A real site photo from the demo bundle (US-JOB-38). */
export const SITE_PHOTO = path.resolve(__dirname, "../../api/assets/demo/site-framing.jpg");

/** US-JOB-30 to US-JOB-38 — a job of the signed-in person's own, with its milestones. */
export async function jobWithMilestones(
  page: Page,
  opts: {
    name?: string;
    contract?: string;
    retentionPct?: number;
    siteAddress?: string;
    startInDays?: number;
    endInDays?: number;
    milestones?: { name: string; amountType?: "percent" | "fixed"; amount: number; dueInDays?: number }[];
  } = {},
) {
  const contact = await api(page, "POST", "/contacts", { type: "customer", name: `Customer ${randomUUID().slice(0, 6)}` });
  const job = await api<{ id: string; number: string; name: string }>(page, "POST", "/jobs", {
    contactId: contact.id,
    name: opts.name ?? `Job ${randomUUID().slice(0, 6)}`,
    currency: "USD",
    contractValueAmount: opts.contract ?? "1000000",
    retentionPct: opts.retentionPct ?? 0,
    siteAddress: opts.siteAddress ?? null,
    startDate: opts.startInDays === undefined ? null : isoDays(opts.startInDays),
    endDate: opts.endInDays === undefined ? null : isoDays(opts.endInDays),
  });
  const milestones = await api<{ id: string; name: string }[]>(page, "PUT", `/jobs/${job.id}/milestones`, {
    milestones: (opts.milestones ?? [{ name: "Site preparation", amount: 30 }, { name: "Steel structure", amount: 40 }, { name: "Roofing & handover", amount: 30 }]).map((m, i) => ({
      name: m.name,
      sequence: i,
      amountType: m.amountType ?? "percent",
      amount: m.amount,
      dueDate: m.dueInDays === undefined ? null : isoDays(m.dueInDays),
    })),
  });
  return { job, contactId: contact.id, milestones };
}

export async function completeMilestone(page: Page, jobId: string, milestoneId: string, photoFileIds: string[] = []) {
  return api(page, "POST", `/jobs/${jobId}/milestones/${milestoneId}/complete`, { photoFileIds });
}

/** Raises the milestone's progress invoice and issues it. */
export async function invoiceMilestone(page: Page, jobId: string, milestoneId: string) {
  const draft = await api(page, "POST", `/jobs/${jobId}/milestones/${milestoneId}/invoice`);
  return api<{ id: string; number: string }>(page, "POST", `/invoices/${draft.id}/issue`);
}

/** Uploads the sample site photo and returns its file id. */
export async function uploadPhoto(page: Page, name = "site.jpg"): Promise<string> {
  const res = await page.request.post(`${API_URL}/files`, {
    headers: { "Idempotency-Key": randomUUID() },
    multipart: { file: { name, mimeType: "image/jpeg", buffer: readFileSync(SITE_PHOTO) } },
  });
  if (!res.ok()) throw new Error(`upload → ${res.status()} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

/** Puts the demo Field user on the job and signs them in on a page of their own. */
export async function fieldUserOn(page: Page, browser: Browser, jobId: string): Promise<Page> {
  const members = (await (await page.request.get(`${API_URL}/org/members`)).json()) as { userId: string; email: string }[];
  const marcus = members.find((m) => m.email === DEMO_FIELD_USER.email)!;
  await api(page, "POST", `/jobs/${jobId}/assignees`, { userId: marcus.userId });
  const fieldPage = await (await browser.newContext()).newPage();
  await logIn(fieldPage, DEMO_FIELD_USER);
  return fieldPage;
}
