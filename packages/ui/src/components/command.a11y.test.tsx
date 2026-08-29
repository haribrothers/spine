import { render } from "@testing-library/react";
import { beforeEach, describe, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./command";

beforeEach(() => {
  // jsdom has no ResizeObserver; cmdk uses it internally to remeasure items.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // jsdom doesn't implement scrollIntoView; cmdk calls it when the selected item changes.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("Command a11y", () => {
  it("has no violations standalone", async () => {
    const { container } = render(
      <Command>
        <CommandInput placeholder="Search contacts, jobs, invoices…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Contacts">
            <CommandItem>Acme Contracting Ltd.</CommandItem>
            <CommandItem>Brightline Interiors</CommandItem>
          </CommandGroup>
          <CommandGroup heading="Jobs">
            <CommandItem>Kitchen remodel — Coastal Fabrication Co.</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    await expectNoA11yViolations(container);
  });

  it("has no violations inside a CommandDialog while open", async () => {
    render(
      <CommandDialog open>
        <CommandInput placeholder="Search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Jobs">
            <CommandItem>Site electrical upgrade — Delta Electrical Services</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>,
    );
    await expectNoA11yViolations(document.body);
  });
});
