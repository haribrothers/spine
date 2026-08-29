import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "./carousel";

describe("Carousel a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <Carousel className="w-72">
        <CarouselContent>
          {["Site photo 1", "Site photo 2", "Site photo 3"].map((label) => (
            <CarouselItem key={label}>
              <div className="flex aspect-video items-center justify-center rounded-md bg-surface-sunken text-[13px] text-on-surface-muted">
                {label}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );
    await expectNoA11yViolations(container);
  });
});
