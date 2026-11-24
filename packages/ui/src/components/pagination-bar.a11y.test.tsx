import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { PaginationBar } from "./pagination-bar";

describe("PaginationBar a11y", () => {
  it("has no violations with multiple pages", async () => {
    const { container } = render(
      <PaginationBar page={1} pageSize={25} total={238} onPageChange={() => {}} onPageSizeChange={() => {}} />,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations when everything fits on one page", async () => {
    const { container } = render(
      <PaginationBar page={1} pageSize={25} total={10} onPageChange={() => {}} onPageSizeChange={() => {}} />,
    );
    await expectNoA11yViolations(container);
  });
});
