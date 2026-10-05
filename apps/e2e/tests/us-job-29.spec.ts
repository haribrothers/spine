import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

type ListedInvoice = { id: string; type: string; status: string; progressClaimNo: number | null; jobId: string | null };

test.describe("US-JOB-29", () => {
  test("a progress invoice raised from a milestone says the claim number comes at issue, then shows it beside the job", async ({ page, seededOrg: _ }) => {
    const post = async (path: string, data: unknown = {}) => {
      const res = await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data });
      expect(res.ok(), `${path}: ${res.status()}`).toBe(true);
      return (await res.json()) as Record<string, unknown>;
    };
    const jobs = (await (await page.request.get(`${API_URL}/jobs`)).json()) as { id: string }[];
    let target: { jobId: string; milestoneId: string } | undefined;
    for (const job of jobs) {
      const milestones = (await (await page.request.get(`${API_URL}/jobs/${job.id}/milestones`)).json()) as { id: string; status: string }[];
      const pending = milestones.find((m) => m.status === "pending");
      if (pending) {
        target = { jobId: job.id, milestoneId: pending.id };
        break;
      }
    }
    expect(target, "a demo job has a pending milestone").toBeTruthy();
    const before = ((await (await page.request.get(`${API_URL}/invoices`)).json()) as ListedInvoice[]).filter((i) => i.jobId === target!.jobId && i.progressClaimNo);
    const expected = Math.max(0, ...before.map((i) => i.progressClaimNo!)) + 1;

    await post(`/jobs/${target!.jobId}/milestones/${target!.milestoneId}/complete`, { photoFileIds: [] });
    const draft = await post(`/jobs/${target!.jobId}/milestones/${target!.milestoneId}/invoice`);
    const draftId = (draft.id ?? (draft.invoice as { id: string } | undefined)?.id) as string;

    await page.goto(`/invoices/${draftId}`);
    await expect(page.getByTestId("invoice-job-card")).toContainText("Claim number is given when the invoice is issued.");

    await post(`/invoices/${draftId}/issue`);
    await page.reload();
    await expect(page.getByTestId("invoice-job-card")).toContainText(`Progress claim ${expected} of this job`);
  });
});
