import { TextField } from "@spine/ui-native";
import { DocScreen, DocSection } from "../../src/components/doc-section";

export function TextFieldScreen() {
  return (
    <DocScreen>
      <DocSection title="Default">
        <TextField placeholder="Enter a value" />
      </DocSection>

      <DocSection title="Error">
        <TextField placeholder="Enter a value" error />
      </DocSection>

      <DocSection title="Disabled">
        <TextField placeholder="Enter a value" editable={false} />
      </DocSection>
    </DocScreen>
  );
}
