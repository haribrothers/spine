import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

export default function DropdownMenuPage() {
  return (
    <div>
      <DocTitle>DropdownMenu</DocTitle>
      <DocLead>A click-triggered floating action list — a table row's overflow menu.</DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="secondary">Actions</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Duplicate</DropdownMenuItem>
    <DropdownMenuItem>Issue credit note</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem destructive>Void invoice</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem>Issue credit note</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive>Void invoice</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
