import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { ScrollX } from "./scroll-x";

describe("ScrollX a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <ScrollX label="Lines, scrolls sideways">
        <table>
          <tbody>
            <tr>
              <td>Window installation</td>
            </tr>
          </tbody>
        </table>
      </ScrollX>,
    );
    await expectNoA11yViolations(container);
  });

  it("US-OPS-62: adds no tab stop when everything fits", () => {
    render(
      <ScrollX label="Lines, scrolls sideways" data-testid="box">
        <p>Short</p>
      </ScrollX>,
    );
    const box = screen.getByTestId("box");
    expect(box.getAttribute("tabindex")).toBeNull();
    expect(box.getAttribute("role")).toBeNull();
    expect(box.className).toContain("overflow-x-auto");
  });
});
