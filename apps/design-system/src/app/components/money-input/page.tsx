"use client";

import { MoneyInput } from "@spine/ui";
import { useState } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { DocLead, DocSection, DocTitle } from "@/components/doc-page";

function MoneyInputDemo() {
  const [amount, setAmount] = useState(124000n);
  return <MoneyInput value={amount} onValueChange={setAmount} currency="USD" className="w-40" />;
}

export default function MoneyInputPage() {
  return (
    <div>
      <DocTitle>MoneyInput</DocTitle>
      <DocLead>
        The currency/minor-unit-aware field (§F0). Right-aligned mono-data typography so a
        column of amounts aligns on the decimal, and it never accepts more precision than the
        currency supports — the value prop is always a <code className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]">bigint</code> in minor units, never a float.
      </DocLead>

      <DocSection id="default" title="Default">
        <ComponentPreview
          code={`const [amount, setAmount] = useState(124000n); // $1,240.00

<MoneyInput value={amount} onValueChange={setAmount} currency="USD" />`}
        >
          <MoneyInputDemo />
        </ComponentPreview>
      </DocSection>
    </div>
  );
}
