import { test, expect } from "./fixtures";
import { api } from "./quote-seed";
import { completeMilestone, invoiceMilestone, jobWithMilestones, uploadPhoto } from "./job-seed";

type Activity = { type: string; detail: string | null };

test.describe("US-JOB-39", () => {
  test("deletes an open photo from its menu and from the viewer, asking first, and the activity says so", async ({ page, seededOrg: _ }) => {
    const { job } = await jobWithMilestones(page);
    for (const caption of ["Wrong site", "Gate north", "Gate south"]) {
      await api(page, "POST", `/jobs/${job.id}/photos`, { fileId: await uploadPhoto(page), caption });
    }

    await page.goto(`/jobs/${job.id}?tab=photos`);
    const photos = page.getByTestId("job-photos");
    await expect(photos.getByTestId("photo-tile")).toHaveCount(3);

    // From the menu: Open, Download, then Delete photo after a divider.
    await photos.getByRole("button", { name: "Actions for Wrong site" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText(["Open", "Download", "Delete photo"]);
    await menu.getByRole("menuitem", { name: "Delete photo" }).click();
    const dialog = page.getByTestId("photo-delete-dialog");
    await expect(dialog).toContainText("Delete this photo?");
    await expect(dialog).toContainText("It's removed from the job and deleted from storage. The job's activity keeps a note that it was removed.");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(photos.getByTestId("photo-tile")).toHaveCount(3);

    await photos.getByRole("button", { name: "Actions for Wrong site" }).click();
    await page.getByRole("menuitem", { name: "Delete photo" }).click();
    await page.getByTestId("photo-delete-dialog").getByRole("button", { name: "Delete photo" }).click();
    await expect(page.getByText("Photo deleted")).toBeVisible();
    await expect(photos.getByTestId("photo-tile")).toHaveCount(2);
    await expect(photos.getByRole("button", { name: "Open Wrong site full size" })).toHaveCount(0);

    // From the viewer: the next photo shows after a delete.
    await photos.getByRole("button", { name: "Open Gate north full size" }).click();
    const viewer = page.getByTestId("photo-viewer");
    await expect(viewer).toContainText("1 of 2");
    await viewer.getByTestId("photo-viewer-delete").click();
    await page.getByTestId("photo-delete-dialog").getByRole("button", { name: "Delete photo" }).click();
    await expect(viewer).toContainText("1 of 1");
    await expect(viewer).toContainText("Gate south");

    const activity = await api<Activity[]>(page, "GET", `/jobs/${job.id}/activity`);
    expect(activity.filter((a) => a.type === "photo_removed").map((a) => a.detail)).toEqual(expect.arrayContaining(["Wrong site", "Gate north"]));
  });

  test("an Owner deletes a photo from an invoiced milestone only with a reason", async ({ page, seededOrg: _ }) => {
    const { job, milestones } = await jobWithMilestones(page);
    await completeMilestone(page, job.id, milestones[0]!.id, [await uploadPhoto(page, "levelling.jpg")]);
    await invoiceMilestone(page, job.id, milestones[0]!.id);

    await page.goto(`/jobs/${job.id}?tab=photos`);
    const photos = page.getByTestId("job-photos");
    await expect(photos).toContainText("Photos with an invoiced milestone are locked: only an Owner can delete them, with a reason.");
    await photos.getByTestId("photo-menu").first().click();
    await page.getByRole("menuitem", { name: "Delete photo" }).click();

    const dialog = page.getByTestId("photo-delete-dialog");
    await expect(dialog).toContainText("Locked · its milestone is invoiced");
    await expect(dialog).toContainText("Delete a photo from an invoiced milestone?");
    const confirm = dialog.getByRole("button", { name: "Delete photo" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Reason").fill("Shows the neighbour's house");
    await confirm.click();
    await expect(page.getByText("Photo deleted")).toBeVisible();
    await expect(photos.getByTestId("photo-tile")).toHaveCount(0);

    const activity = await api<Activity[]>(page, "GET", `/jobs/${job.id}/activity`);
    expect(activity.find((a) => a.type === "photo_removed")?.detail).toContain("Shows the neighbour's house");
  });
});
