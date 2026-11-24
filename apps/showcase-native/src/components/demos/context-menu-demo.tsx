import { useState } from "react";
import { Text } from "react-native";
import { ContextMenu } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function ContextMenuDemo() {
  const [lastAction, setLastAction] = useState<string | null>(null);

  return (
    <>
      <DemoLead>
        `@expo/ui`’s community MenuView — a real native long-press/tap menu (SwiftUI `Menu`/`ContextMenu` on iOS,
        Jetpack Compose `DropdownMenu` on Android). A flat `actions` array, not a compound-component tree — see
        `context-menu.tsx`’s own doc comment for why.
      </DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <ContextMenu
            actions={[
              { id: "edit", title: "Edit" },
              { id: "duplicate", title: "Duplicate" },
              { id: "delete", title: "Delete", destructive: true },
            ]}
            onPressAction={setLastAction}
          >
            <Text className="rounded-lg border border-border bg-surface-sunken px-4 py-3 text-[14px] text-on-surface dark:border-border-dark dark:bg-surface-sunken-dark dark:text-on-surface-dark">
              Long-press or tap me
            </Text>
          </ContextMenu>
        </DemoPreview>
        {lastAction ? (
          <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">Last action: {lastAction}</Text>
        ) : null}
      </DemoSection>
    </>
  );
}
