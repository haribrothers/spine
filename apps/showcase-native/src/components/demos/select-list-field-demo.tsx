import { useState } from "react";
import { SelectListField } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

const CLIENT_OPTIONS = [
  { label: "Acme Contracting Ltd.", value: "acme" },
  { label: "Bright Homes", value: "bright" },
  { label: "Coastal Renovations", value: "coastal" },
  { label: "Dunmore & Sons", value: "dunmore" },
  { label: "Elmfield Developments", value: "elmfield" },
];

export function SelectListFieldDemo() {
  const [value, setValue] = useState<string | null>("bright");

  return (
    <>
      <DemoLead>
        The "large list" counterpart to `SelectField` — opens a `BottomSheet` with a search box above a filterable,
        scrollable option list. See Templates → Job Edit for this at a real 120-option scale.
      </DemoLead>
      <DemoSection title="Row variant, with a floating label">
        <DemoPreview>
          <SelectListField
            options={CLIENT_OPTIONS}
            value={value}
            onValueChange={setValue}
            floatingLabel="Client"
            searchPlaceholder="Search clients…"
            sheetTitle="Select client"
            variant="row"
          />
        </DemoPreview>
      </DemoSection>
    </>
  );
}
