"use client";

import { MoneyInput } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { CodeBlock } from "@/components/code-block";
import { ApiTable, DocLead, DocSection, DocTitle, FeatureList } from "@/components/doc-page";

function MoneyInputDemo() {
  const [amount, setAmount] = useState(124000n);
  return <MoneyInput value={amount} onValueChange={setAmount} currency="USD" className="w-40" />;
}

export default function MoneyInputPage() {
  return (
    <div>
      <DocTitle>MoneyInput</DocTitle>
      <DocLead>
        The currency/minor-unit-aware field required by PRD §F0. Right-aligned mono-data
        typography so a column of amounts aligns on the decimal, and it never accepts more
        precision than the currency supports — the value prop is always a{" "}
        <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">bigint</code>{" "}
        in minor units, never a float.
      </DocLead>

      <ComponentPreview>
        <MoneyInputDemo />
      </ComponentPreview>

      <DocSection id="features" title="Features">
        <FeatureList
          items={[
            "Backed by @spine/shared's toDecimalString/fromDecimalString so formatting can never drift from the ledger's own money math.",
            "Rejects keystrokes that would produce more fractional digits than the currency's minor-unit exponent supports.",
            "Correctly handles zero-decimal (JPY) and three-decimal (KWD, BHD, OMR) currencies, not just the common 2-decimal case.",
            "Snaps back to canonical formatting (e.g. \"5\" -> \"5.00\") on blur.",
          ]}
        />
      </DocSection>

      <DocSection id="anatomy" title="Anatomy">
        <CodeBlock
          code={`import { MoneyInput } from "@spine/ui";

export default () => {
  const [amount, setAmount] = useState(124000n); // $1,240.00
  return <MoneyInput value={amount} onValueChange={setAmount} currency="USD" />;
};`}
        />
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <ApiTable
          rows={[
            { prop: "value", type: "bigint" },
            { prop: "onValueChange", type: "(amount: bigint) => void" },
            { prop: "currency", type: "string (ISO 4217)" },
            { prop: "error", type: "boolean", defaultValue: "false" },
          ]}
        />
      </DocSection>

      <DocSection id="examples" title="Examples">
        <DocLead>Default</DocLead>
        <ComponentPreview
          code={`const [amount, setAmount] = useState(124000n); // $1,240.00

<MoneyInput value={amount} onValueChange={setAmount} currency="USD" />`}
        >
          <MoneyInputDemo />
        </ComponentPreview>
      </DocSection>

      <DocSection id="accessibility" title="Accessibility">
        <DocLead>
          Uses <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">inputMode="decimal"</code>{" "}
          so mobile devices present a numeric keyboard. Pair with FormField for a proper label.
        </DocLead>
      </DocSection>
    </div>
  );
}
