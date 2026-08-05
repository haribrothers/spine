import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function MenubarPage() {
  return (
    <div>
      <DocTitle>Menubar</DocTitle>
      <DocLead>
        A visually persistent menu common in desktop applications that provides quick access to
        a consistent set of commands. Not currently used anywhere in Spine's own screens — its
        admin shells use SideNav, not a File/Edit-style menu bar — included in the catalogue
        for completeness.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Full keyboard navigation with typeahead.", "Supports submenus, checkable items, and groups within each menu."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem } from "@spine/ui";

export default () => (
  <Menubar>
    <MenubarMenu>
      <MenubarTrigger />
      <MenubarContent>
        <MenubarItem />
      </MenubarContent>
    </MenubarMenu>
  </Menubar>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "MenubarItem.destructive", type: "boolean", defaultValue: "false" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<Menubar>
  <MenubarMenu>
    <MenubarTrigger>File</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>New</MenubarItem>
      <MenubarItem>Open…</MenubarItem>
      <MenubarSeparator />
      <MenubarItem destructive>Close</MenubarItem>
    </MenubarContent>
  </MenubarMenu>
  <MenubarMenu>
    <MenubarTrigger>Edit</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>Undo</MenubarItem>
      <MenubarItem>Redo</MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</Menubar>`}
        >
          <Menubar>
            <MenubarMenu>
              <MenubarTrigger>File</MenubarTrigger>
              <MenubarContent>
                <MenubarItem>New</MenubarItem>
                <MenubarItem>Open…</MenubarItem>
                <MenubarSeparator />
                <MenubarItem destructive>Close</MenubarItem>
              </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
              <MenubarTrigger>Edit</MenubarTrigger>
              <MenubarContent>
                <MenubarItem>Undo</MenubarItem>
                <MenubarItem>Redo</MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "ArrowRight", description: "Moves focus to the next menu." },
            { keys: "ArrowLeft", description: "Moves focus to the previous menu." },
            { keys: "ArrowDown", description: "Opens the focused menu and moves to the first item." },
            { keys: "Esc", description: "Closes the open menu." },
          ]}
        />
      </DocSection>
    </div>
  );
}
