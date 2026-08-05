import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function DrawerPage() {
  return (
    <div>
      <DocTitle>Drawer</DocTitle>
      <DocLead>
        Same underlying primitive as Dialog — full-height and anchored to an edge instead of
        centered. Used for a longer flow, e.g. a quote's line-item editor.
      </DocLead>

      <DocSection id="default" title="Default">
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
      <Button variant="secondary">Cancel</Button>
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
                <Button variant="secondary">Cancel</Button>
                <Button>Save</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
