import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@spine/ui";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList, KeyboardTable } from "@/components/doc-page";

export default function NavigationMenuPage() {
  return (
    <div>
      <DocTitle>NavigationMenu</DocTitle>
      <DocLead>
        A collection of links for navigating websites. A horizontal bar with dropdown/mega-menu
        lists — for a top-level marketing-style nav with grouped links; NavItem/SideNav remain
        the pattern for a vertical admin sidebar, don't reach for this there.
      </DocLead>

      <DocSection id="features" title="Features">
        <FeatureList items={["Can display simple links or rich dropdown content per top-level item.", "Full keyboard navigation.", "Accessible on both mouse and keyboard, including support for RTL direction."]} />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink } from "@spine/ui";

export default () => (
  <NavigationMenu>
    <NavigationMenuList>
      <NavigationMenuItem>
        <NavigationMenuTrigger />
        <NavigationMenuContent>
          <NavigationMenuLink />
        </NavigationMenuContent>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
);`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable rows={[{ prop: "…", type: "standard Radix NavigationMenu props" }]} />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`<NavigationMenu>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>Product</NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-48 gap-1 p-2">
          <li><NavigationMenuLink href="#">Quotes</NavigationMenuLink></li>
          <li><NavigationMenuLink href="#">Invoices</NavigationMenuLink></li>
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>`}
        >
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Product</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-48 gap-1 p-2">
                    <li>
                      <NavigationMenuLink href="#" className="block rounded-sm px-2 py-1.5 text-[13px] text-on-surface hover:bg-surface-sunken">
                        Quotes
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink href="#" className="block rounded-sm px-2 py-1.5 text-[13px] text-on-surface hover:bg-surface-sunken">
                        Invoices
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <KeyboardTable
          rows={[
            { keys: "ArrowRight", description: "Moves focus to the next menu item." },
            { keys: "ArrowLeft", description: "Moves focus to the previous menu item." },
            { keys: "ArrowDown", description: "Opens the focused item's content." },
            { keys: "Esc", description: "Closes the open content." },
          ]}
        />
      </DocSection>
    </div>
  );
}
