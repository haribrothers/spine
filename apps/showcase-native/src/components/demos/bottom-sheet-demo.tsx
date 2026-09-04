import { useState } from "react";
import { Text } from "react-native";
import { BottomSheet, Button } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function BottomSheetDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DemoLead>
        `@expo/ui`'s universal BottomSheet — genuinely cross-platform (iOS, Android, and web), a real native modal
        sheet.
      </DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <Button variant="secondary" onPress={() => setOpen(true)}>
            Open sheet
          </Button>
        </DemoPreview>
      </DemoSection>
      <BottomSheet isPresented={open} onDismiss={() => setOpen(false)}>
        <Text className="p-4 text-[15px] font-medium text-on-surface dark:text-on-surface-dark">Bottom Sheet content</Text>
        <Text className="px-4 pb-4 text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
          Swipe down or tap the backdrop to dismiss.
        </Text>
      </BottomSheet>
    </>
  );
}
