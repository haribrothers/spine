import { describe, expect, it } from "vitest";
import { createJobSchema, JOB_END_BEFORE_START } from "@spine/shared";
import { defaultSiteAddress } from "../app/(app)/jobs/new-job-drawer";
import type { Address } from "../app/(app)/contacts/types";

const address = (over: Partial<Address>): Address => ({ id: "a", contactId: "c", type: "billing", line1: "1 Main St", line2: null, city: null, state: null, postalCode: null, country: null, isPrimary: false, stateCode: null, ...over });

describe("US-JOB-30 · start a job from the jobs list", () => {
  it("fills the site address from the contact's site address, primary first, else its billing address", () => {
    expect(
      defaultSiteAddress([
        address({ type: "billing", line1: "Head office" }),
        address({ type: "site", line1: "Plot 7", city: "Baner Road", state: "Pune", postalCode: "411045" }),
        address({ type: "site", line1: "14, 3rd Cross", line2: "HSR Layout", city: "Bengaluru", postalCode: "560102", isPrimary: true }),
      ]),
    ).toBe("14, 3rd Cross, HSR Layout, Bengaluru, 560102");
    expect(defaultSiteAddress([address({ type: "billing", line1: "Head office", city: "Pune" })])).toBe("Head office, Pune");
    expect(defaultSiteAddress([address({ type: "shipping" })])).toBe("");
  });

  it("refuses an end date before the start date, with what to do", () => {
    const base = { contactId: "00000000-0000-4000-8000-000000000000", name: "Bathroom refit", currency: "INR" };
    const bad = createJobSchema.safeParse({ ...base, startDate: "2026-11-30", endDate: "2026-10-01" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe(JOB_END_BEFORE_START);
    expect(JOB_END_BEFORE_START).toBe("End the job on or after its start date.");
    expect(createJobSchema.safeParse({ ...base, startDate: "2026-10-01", endDate: "2026-10-01" }).success).toBe(true);
    expect(createJobSchema.safeParse({ ...base, endDate: "2026-10-01" }).success).toBe(true);
  });
});
