import { useState } from "react";
import { SelectField } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

const STATUS_OPTIONS = [
  { label: "Not started", value: "not_started" },
  { label: "In progress", value: "in_progress" },
  { label: "On hold", value: "on_hold" },
  { label: "Completed", value: "completed" },
];

export function SelectFieldDemo() {
  const [value, setValue] = useState("in_progress");
  const [floating, setFloating] = useState("in_progress");

  return (
    <>
      <DemoLead>
        A short, fixed-enum select opening a real native menu — for a form row, not a standalone control. Reach for
        `SelectListField` instead when the option list is long and benefits from search.
      </DemoLead>
      <DemoSection title="Bordered (default)">
        <DemoPreview>
          <SelectField options={STATUS_OPTIONS} value={value} onValueChange={setValue} />
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Row variant with a floating label — for a borderless grouped-card form row">
        <DemoPreview>
          <SelectField options={STATUS_OPTIONS} value={floating} onValueChange={setFloating} variant="row" floatingLabel="Status" />
        </DemoPreview>
      </DemoSection>
    </>
  );
}
