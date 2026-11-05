import { useState } from "react";
import { View } from "react-native";
import { FloatingLabelField } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function FloatingLabelFieldDemo() {
  const [title, setTitle] = useState("Kitchen extension");
  const [empty, setEmpty] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <>
      <DemoLead>
        A Material-style floating label — empty, the label sits centered acting as the placeholder itself; once
        focused or a value exists, it animates/snaps up to a small caption above the value. iOS uses `NativeTextField`
        internally; Android uses `TextField` — see this component’s own doc comment. With Reduce Motion or Remove
        animations on, the label moves without animating.
      </DemoLead>
      <DemoSection title="With a value">
        <DemoPreview>
          <View className="w-full">
            <FloatingLabelField label="Title" required value={title} onChangeText={setTitle} />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Empty (label acts as the placeholder)">
        <DemoPreview>
          <View className="w-full">
            <FloatingLabelField label="Job value" required value={empty} onChangeText={setEmpty} keyboardType="decimal" />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Error">
        <DemoPreview>
          <View className="w-full">
            <FloatingLabelField label="Title" required value="" onChangeText={() => {}} error />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Sign-in fields (email and password)">
        <DemoPreview>
          <View className="w-full gap-2">
            <FloatingLabelField label="Email" value={email} onChangeText={setEmail} keyboardType="email" forceTextField autoCapitalize="none" autoComplete="email" returnKeyType="next" />
            <FloatingLabelField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" returnKeyType="go" />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Multiline">
        <DemoPreview>
          <View className="w-full">
            <FloatingLabelField label="Notes" value={notes} onChangeText={setNotes} multiline />
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
