import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Display, H1, H2, H3, Lead, Muted, P } from "./typography";

describe("Typography a11y", () => {
  it("has no violations across the type scale", async () => {
    const { container } = render(
      <div>
        <Display>Spine</Display>
        <H1>Invoice INV-2026-0042</H1>
        <H2>Line items</H2>
        <H3>Retention</H3>
        <Lead>A self-hosted business management app for small service businesses.</Lead>
        <P>Retention is held until the defect liability period ends.</P>
        <Muted>Last updated 2 hours ago</Muted>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
