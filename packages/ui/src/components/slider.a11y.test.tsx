import { render } from "@testing-library/react";
import { beforeEach, describe, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Slider } from "./slider";

beforeEach(() => {
  // jsdom has no ResizeObserver; Radix Slider uses it to measure the track.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe("Slider a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <Slider defaultValue={[10]} max={100} step={1} aria-label="Retention percentage" className="w-64" />,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations when disabled", async () => {
    const { container } = render(
      <Slider defaultValue={[10]} max={100} step={1} aria-label="Retention percentage" disabled className="w-64" />,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations with a multi-thumb range", async () => {
    const { container } = render(
      <Slider defaultValue={[20, 80]} max={100} step={1} aria-label="Discount range" className="w-64" />,
    );
    await expectNoA11yViolations(container);
  });
});
