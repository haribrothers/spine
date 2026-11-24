import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("Tabs a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="details">Job site: Riverbend Fabrication, Bay 3 extension.</TabsContent>
        <TabsContent value="timeline">Quote sent 3 days ago.</TabsContent>
        <TabsContent value="documents">No documents attached.</TabsContent>
      </Tabs>,
    );
    await expectNoA11yViolations(container);
  });
});
