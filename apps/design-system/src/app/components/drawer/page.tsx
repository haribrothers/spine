import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function DrawerPage() {
  return (
    <div>
      <DocTitle>Drawer</DocTitle>
      <DocLead>
        A panel that slides in from an edge of the screen. Same underlying primitive as Dialog
        — full-height and anchored to an edge instead of centered. Used for a longer flow, e.g.
        a quote's line-item editor.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Anchors to the left or right edge via the side prop on DrawerContent.", "Same focus-trap and Escape-to-close behavior as Dialog."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@spine/ui";

export default () => (
  <Drawer>
    <DrawerTrigger />
    <DrawerContent side="right">
      <DrawerHeader>
        <DrawerTitle />
        <DrawerDescription />
      </DrawerHeader>
      <DrawerFooter>
        <DrawerClose />
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "DrawerContent.side", type: "left | right", defaultValue: "right" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Drawer>
  <DrawerTrigger asChild>
    <Button variant="secondary">Edit line items</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Line items</DrawerTitle>
      <DrawerDescription>Riverside Extension — Quote QUO-2026-0018</DrawerDescription>
    </DrawerHeader>
    <DrawerFooter>
      <DrawerClose asChild>
        <Button variant="secondary">Cancel</Button>
      </DrawerClose>
      <Button>Save</Button>
    </DrawerFooter>
  </DrawerContent>
</Drawer>`}
        >
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="secondary">Edit line items</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Line items</DrawerTitle>
                <DrawerDescription>Riverside Extension — Quote QUO-2026-0018</DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DrawerClose>
                <Button>Save</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "Tab", description: "Moves focus to the next focusable element within the drawer." },
            { keys: "Esc", description: "Closes the drawer and returns focus to the trigger." },
          ]}
        />
      </DocSection>
    </div>
  );
}
