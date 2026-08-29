import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

describe("Card a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Riverside Extension</CardTitle>
          <CardDescription>Job #JOB-0042 — Acme Contracting Ltd.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-on-surface-muted">Balance due: $4,250.00</p>
        </CardContent>
        <CardFooter>
          <Button variant="secondary">View job</Button>
        </CardFooter>
      </Card>,
    );
    await expectNoA11yViolations(container);
  });
});
