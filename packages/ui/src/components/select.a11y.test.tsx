import { render } from "@testing-library/react";
import { beforeEach, describe, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Label } from "./label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "./select";

beforeEach(() => {
  // jsdom has no scrollIntoView; Radix Select calls it when positioning the
  // highlighted item on open.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("Select a11y", () => {
  it("has no violations while open", async () => {
    render(
      <div>
        <Label htmlFor="quote-status">Quote status</Label>
        <Select defaultValue="draft" open>
          <SelectTrigger id="quote-status" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>,
    );
    // Radix portals SelectContent onto document.body, outside the render container.
    await expectNoA11yViolations(document.body);
  });

  it("has no violations while open with grouped options", async () => {
    render(
      <div>
        <Label htmlFor="currency">Currency</Label>
        <Select defaultValue="usd" open>
          <SelectTrigger id="currency" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Common</SelectLabel>
              <SelectItem value="usd">USD</SelectItem>
              <SelectItem value="eur">EUR</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Other</SelectLabel>
              <SelectItem value="jpy">JPY</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>,
    );
    await expectNoA11yViolations(document.body);
  });

  it("has no violations when disabled", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="quote-status-disabled">Quote status</Label>
        <Select defaultValue="draft" disabled>
          <SelectTrigger id="quote-status-disabled" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
