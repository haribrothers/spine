import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";
import { SITE_PHOTO, completeMilestone, jobWithMilestones, uploadPhoto } from "./job-seed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-JOB-36", () => {
  test("adds several photos at once — one failing says why while the rest upload — grouped by milestone, opening full size", async ({ page, seededOrg: _ }) => {
    const { job, milestones } = await jobWithMilestones(page);
    await completeMilestone(page, job.id, milestones[0]!.id, [await uploadPhoto(page, "levelling.jpg"), await uploadPhoto(page, "cleared.jpg")]);

    // The second of two files is refused by the server.
    await page.route(`${API_URL}/files`, async (route) => {
      if (route.request().postDataBuffer()?.includes("broken.jpg")) {
        await route.fulfill({ status: 413, contentType: "application/json", body: JSON.stringify({ statusCode: 413, message: "This file is over the 10 MB limit." }) });
      } else await route.continue();
    });

    await page.goto(`/jobs/${job.id}?tab=photos`);
    const photos = page.getByTestId("job-photos");
    await expect(photos.getByRole("button", { name: "Add photos" })).toBeVisible();
    const buffer = readFileSync(SITE_PHOTO);
    await photos.getByTestId("photo-input").setInputFiles([
      { name: "gate-north.jpg", mimeType: "image/jpeg", buffer },
      { name: "broken.jpg", mimeType: "image/jpeg", buffer },
    ]);
    const failed = photos.getByTestId("photo-upload").filter({ hasText: "broken.jpg" });
    await expect(failed).toContainText("This file is over the 10 MB limit.");
    await expect(page.getByRole("tab", { name: "Photos, 3" })).toBeVisible();

    const groups = photos.getByTestId("photo-group");
    await expect(groups.nth(0)).toContainText("Site photos · 1");
    await expect(groups.nth(1)).toContainText(/Site preparation · completed \w+ \d+ · 2/);

    await groups.nth(1).getByRole("button").first().click();
    const viewer = page.getByTestId("photo-viewer");
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText("Site preparation · 1 of 2");
    await expect(viewer).toContainText(/Added by .+ with “Site preparation”/);
    await expect(viewer.getByRole("link", { name: "Download" })).toHaveAttribute("href", /\/files\/[0-9a-f-]+\?download=1$/);
    await page.keyboard.press("ArrowRight");
    await expect(viewer).toContainText("Site preparation · 2 of 2");
    await expect(viewer.getByRole("button", { name: "Next photo" })).toBeDisabled();
    await viewer.getByRole("button", { name: "Previous photo" }).click();
    await expect(viewer).toContainText("1 of 2");
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);

    await failed.getByRole("button", { name: "Dismiss" }).click();
    await expect(photos.getByTestId("photo-upload")).toHaveCount(0);
  });
});
