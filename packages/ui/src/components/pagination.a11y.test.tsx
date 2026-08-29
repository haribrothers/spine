import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Pagination } from "./pagination";

describe("Pagination a11y", () => {
  it("has no violations mid-range", async () => {
    const { container } = render(<Pagination page={4} pageCount={10} onPageChange={() => {}} />);
    await expectNoA11yViolations(container);
  });

  it("has no violations on the first page", async () => {
    const { container } = render(<Pagination page={1} pageCount={5} onPageChange={() => {}} />);
    await expectNoA11yViolations(container);
  });

  it("has no violations on the last page", async () => {
    const { container } = render(<Pagination page={5} pageCount={5} onPageChange={() => {}} />);
    await expectNoA11yViolations(container);
  });
});
