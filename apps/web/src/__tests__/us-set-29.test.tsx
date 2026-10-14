import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmailSetupWarning } from "../app/(app)/emails/email-setup-warning";

const status = { smtpConfigured: true, waiting: 0, failedRecently: 0, sentToday: 4, lastError: null };

describe("US-SET-29 · know when email isn't set up", () => {
  it("says email isn't set up, how many emails are waiting and what to set", () => {
    render(<EmailSetupWarning status={{ ...status, smtpConfigured: false, waiting: 12 }} />);
    expect(screen.getByTestId("email-setup-warning").textContent).toBe(
      "Email isn't set up — 12 emails are waiting. Set SMTP_HOST (and SMTP_USER, SMTP_PASSWORD, SMTP_FROM) on the server, then restart Spine; waiting emails go out once it's set.",
    );
  });

  it("says emails are failing, with the last error, when the last 3 in a row failed", () => {
    render(<EmailSetupWarning status={{ ...status, lastError: "535 Authentication failed" }} />);
    expect(screen.getByTestId("email-setup-warning").textContent).toContain("Emails are failing — the last error was: 535 Authentication failed.");
  });

  it("says nothing when email is working", () => {
    const { container } = render(<EmailSetupWarning status={status} />);
    expect(container.textContent).toBe("");
  });
});
