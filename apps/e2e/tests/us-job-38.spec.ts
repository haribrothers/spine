import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-JOB-38", () => {
  test("the demo's job photos are real site photos, not a 1 × 1 placeholder", async ({ page, seededOrg: _ }) => {
    const jobs = (await (await page.request.get(`${API_URL}/jobs`)).json()) as { id: string; isDemo: boolean }[];
    const demo = jobs.find((j) => j.isDemo)!;
    await page.goto(`/jobs/${demo.id}?tab=photos`);
    const first = page.getByTestId("photo-group").first().locator("img").first();
    await expect(first).toBeVisible();
    await expect.poll(() => first.evaluate((img: { naturalWidth: number }) => img.naturalWidth)).toBeGreaterThan(400);
  });
});
