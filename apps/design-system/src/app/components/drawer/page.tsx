import {
  Button,
  Drawer,
  DrawerBody,
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

      <ComponentPreview>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="secondary">Edit line items</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Line items</DrawerTitle>
              <DrawerDescription>Riverside Extension — Quote QUO-2026-0018</DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <p className="text-[13px] text-on-surface-muted">Scrollable content goes here.</p>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DrawerClose>
              <Button>Save</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Anchors to the left or right edge via the side prop on DrawerContent.",
            "Three widths via the size prop on DrawerContent — sm, md (default), lg — same naming convention as Dialog's size prop.",
            "DrawerHeader and DrawerFooter are fixed (shrink-0) and never scroll; DrawerBody is the only scrollable region, so a tall form's header/footer stay pinned while its middle content scrolls.",
            "Same focus-trap and Escape-to-close behavior as Dialog.",
            "Renders above Dialog/Drawer content at the z-modal tier — a Select or DropdownMenu opened from inside a Drawer correctly renders above it, at the z-popover tier.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerClose } from "@spine/ui";

export default () => (
  <Drawer>
    <DrawerTrigger />
    <DrawerContent side="right" size="md">
      <DrawerHeader>
        <DrawerTitle />
        <DrawerDescription />
      </DrawerHeader>
      <DrawerBody>
        {/* scrollable content */}
      </DrawerBody>
      <DrawerFooter>
        <DrawerClose />
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "DrawerContent.side", type: "left | right", defaultValue: "right" },
            { prop: "DrawerContent.size", type: "sm | md | lg", defaultValue: "md" },
          ]}
        />
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
    <DrawerBody>
      <p>Scrollable content goes here.</p>
    </DrawerBody>
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
              <DrawerBody>
                <p className="text-[13px] text-on-surface-muted">Scrollable content goes here.</p>
              </DrawerBody>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DrawerClose>
                <Button>Save</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </ComponentPreview>

        <DocLead>Sizes</DocLead>
        <ComponentPreview
          code={`<Drawer>
  <DrawerTrigger asChild>
    <Button variant="secondary">Small (sm)</Button>
  </DrawerTrigger>
  <DrawerContent size="sm">
    <DrawerHeader>
      <DrawerTitle>Small drawer</DrawerTitle>
    </DrawerHeader>
    <DrawerBody>
      <p>max-w-sm — a narrow, single-field flow.</p>
    </DrawerBody>
  </DrawerContent>
</Drawer>

<Drawer>
  <DrawerTrigger asChild>
    <Button variant="secondary">Large (lg)</Button>
  </DrawerTrigger>
  <DrawerContent size="lg">
    <DrawerHeader>
      <DrawerTitle>Large drawer</DrawerTitle>
    </DrawerHeader>
    <DrawerBody>
      <p>max-w-2xl — a longer, multi-field flow.</p>
    </DrawerBody>
  </DrawerContent>
</Drawer>`}
        >
          <div className="flex gap-2">
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="secondary">Small (sm)</Button>
              </DrawerTrigger>
              <DrawerContent size="sm">
                <DrawerHeader>
                  <DrawerTitle>Small drawer</DrawerTitle>
                </DrawerHeader>
                <DrawerBody>
                  <p className="text-[13px] text-on-surface-muted">max-w-sm — a narrow, single-field flow.</p>
                </DrawerBody>
              </DrawerContent>
            </Drawer>
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="secondary">Large (lg)</Button>
              </DrawerTrigger>
              <DrawerContent size="lg">
                <DrawerHeader>
                  <DrawerTitle>Large drawer</DrawerTitle>
                </DrawerHeader>
                <DrawerBody>
                  <p className="text-[13px] text-on-surface-muted">max-w-2xl — a longer, multi-field flow.</p>
                </DrawerBody>
              </DrawerContent>
            </Drawer>
          </div>
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
