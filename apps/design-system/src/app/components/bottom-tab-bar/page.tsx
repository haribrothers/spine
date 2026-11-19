"use client";

import { BottomTabBar, type BottomTabBarItem } from "@spine/ui";
import { FileText, HardHat, House, Menu, Wallet } from "lucide-react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

const ITEMS: BottomTabBarItem[] = [
  { key: "home", href: "#", label: "Home", icon: <House aria-hidden />, current: false },
  { key: "sales", href: "#", label: "Sales", icon: <FileText aria-hidden />, current: false },
  { key: "jobs", href: "#", label: "Jobs", icon: <HardHat aria-hidden />, current: false },
  { key: "money", href: "#", label: "Money", icon: <Wallet aria-hidden />, current: true },
  { key: "more", href: "#", label: "More", icon: <Menu aria-hidden />, current: false },
];

export default function BottomTabBarPage() {
  return (
    <div>
      <DocTitle>BottomTabBar</DocTitle>
      <DocLead>The bar along the bottom of the web app under 768px: Home · Sales · Jobs · Money · More, each an icon over its label (US-OPS-54, D-283).</DocLead>

      <ComponentPreview>
        {/* Shown at phone width: the bar hides itself from 768px up. */}
        <div className="w-[390px] max-w-full overflow-hidden rounded-md border border-border [&_nav]:!flex">
          <BottomTabBar
            items={ITEMS}
            buttonKeys={["more"]}
            renderLink={(item, props) => (
              <a href={item.href} className={props.className} aria-current={props["aria-current"]}>
                {props.children}
              </a>
            )}
            renderButton={(_item, props) => (
              <button type="button" className={props.className}>
                {props.children}
              </button>
            )}
          />
        </div>
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Up to five tabs; a tab whose pages the person can't open isn't rendered.",
            "The current tab: a tinted pill behind its icon, a heavier label and aria-current — never colour alone.",
            "Every tab at least 44×44px, above the home indicator.",
            "Hides while a full-screen sheet is open or, on a touch screen, while a text field has focus.",
            "A navigation landmark named Main; hidden from 768px up.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock code={`<BottomTabBar items={tabs} buttonKeys={["more"]} renderLink={…} renderButton={…} />`} />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "items", type: "{ key, href, label, icon, current }[]" },
            { prop: "renderLink", type: "(item, { className, aria-current, children }) => ReactNode" },
            { prop: "renderButton", type: "(item, { className, children }) => ReactNode" },
            { prop: "buttonKeys", type: "string[] — tabs rendered as buttons (More)" },
          ]}
        />
      </DocSection>
    </div>
  );
}
