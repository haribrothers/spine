import { useState } from "react";
import { Select } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

const CURRENCY_OPTIONS = [
  { label: "USD", value: "usd" },
  { label: "EUR", value: "eur" },
  { label: "JPY", value: "jpy" },
];

export function SelectDemo() {
  const [value, setValue] = useState("usd");

  return (
    <>
      <DemoLead>
        `@expo/ui`'s universal Picker — a real native picker (a compact menu on both platforms by default; SwiftUI
        also offers an inline `wheel` appearance on iOS).
      </DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <Select options={CURRENCY_OPTIONS} value={value} onValueChange={setValue} />
        </DemoPreview>
      </DemoSection>
    </>
  );
}
