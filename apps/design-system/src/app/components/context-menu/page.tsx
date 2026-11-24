import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function ContextMenuPage() {
  return (
    <div>
      <DocTitle>ContextMenu</DocTitle>
      <DocLead>
        Displays a menu located at the pointer, triggered by a right click or a long press.
        Identical visual list to DropdownMenu — same styling, different trigger gesture; don't
        hand-roll a second menu visual language for it.
      </DocLead>

      <ComponentPreview>
        <ContextMenu>
          <ContextMenuTrigger className="flex h-24 w-64 items-center justify-center rounded-md border border-dashed border-border text-[13px] text-on-surface-muted">
            Right-click here
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>
              <Pencil aria-hidden />
              Edit
            </ContextMenuItem>
            <ContextMenuItem>
              <Copy aria-hidden />
              Duplicate
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem destructive>
              <Trash2 aria-hidden />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList items={["Items style their icon like DropdownMenu's: 14 px, muted, 10 px before the label, red when destructive (US-OPS-37).", "Supports submenus, checkable items, and groups — the same sub-part shapes as DropdownMenu.", "Full keyboard navigation with typeahead."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@spine/ui";

export default () => (
  <ContextMenu>
    <ContextMenuTrigger />
    <ContextMenuContent>
      <ContextMenuItem />
    </ContextMenuContent>
  </ContextMenu>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "ContextMenuItem.destructive", type: "boolean", defaultValue: "false" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default — right-click the box below</DocLead>
        <ComponentPreview
          code={`<ContextMenu>
  <ContextMenuTrigger className="flex h-24 w-64 items-center justify-center rounded-md border border-dashed border-border text-on-surface-muted">
    Right-click here
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>Duplicate</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem destructive>Delete</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>`}
        >
          <ContextMenu>
            <ContextMenuTrigger className="flex h-24 w-64 items-center justify-center rounded-md border border-dashed border-border text-[13px] text-on-surface-muted">
              Right-click here
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>Duplicate</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem destructive>Delete</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "Shift+F10", description: "Opens the menu at the focused element (keyboard equivalent of right-click)." },
            { keys: "ArrowDown", description: "Moves focus to the next item." },
            { keys: "ArrowUp", description: "Moves focus to the previous item." },
            { keys: "Esc", description: "Closes the menu." },
          ]}
        />
      </DocSection>
    </div>
  );
}
