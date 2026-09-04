import { View } from "react-native";
import { Button, Toast, useToast } from "@spine/ui-native";
import { DocScreen } from "../../src/components/doc-section";
import { DocTitle, DocLead, DocSection, FeatureList, ApiTable } from "../../src/components/doc-page";
import { ComponentPreview } from "../../src/components/component-preview";
import { CodeBlock } from "../../src/components/code-block";

function ToastDemo() {
  const { message, show, dismiss } = useToast(3000);
  return (
    <View className="w-full gap-3">
      <Button
        variant="secondary"
        onPress={() => show("Invoice sent", "INV-2026-0042 was emailed to Acme Contracting Ltd.")}
      >
        Send invoice
      </Button>
      {message ? <Toast title={message.title} description={message.description} onDismiss={dismiss} /> : null}
    </View>
  );
}

export function ToastScreen() {
  return (
    <DocScreen>
      <DocTitle>Toast</DocTitle>
      <DocLead>
        A succinct message that is displayed temporarily. Dark chrome, auto-dismissing — confirms an action
        succeeded. Never carries a validation error, which belongs inline once this package has a HelperText
        equivalent.
      </DocLead>

      <ComponentPreview>
        <ToastDemo />
      </ComponentPreview>

      <DocSection title="Features">
        <FeatureList
          items={[
            "useToast(duration) is a single-message-at-a-time hook, matching the pattern apps/web actually uses per-screen (entity-toast.tsx) rather than a shared global queue — no Radix ToastProvider/Viewport equivalent needed.",
            "Calling show() again while a toast is visible replaces the message and resets the auto-dismiss timer, rather than queuing a second toast.",
            "Chrome stays dark regardless of the app's own light/dark theme — it reads raw light-mode neutral900/neutral50 values directly rather than theme-reactive dark: classNames, avoiding the contrast collapse those would cause in dark mode.",
          ]}
        />
      </DocSection>

      <DocSection title="Anatomy">
        <CodeBlock
          code={`import { Toast, useToast } from "@spine/ui-native";

const { message, show, dismiss } = useToast();

<Button onPress={() => show("Invoice sent", "INV-2026-0042 was emailed.")}>Send invoice</Button>
{message ? <Toast title={message.title} description={message.description} onDismiss={dismiss} /> : null}`}
        />
      </DocSection>

      <DocSection title="API Reference">
        <ApiTable
          rows={[
            { prop: "useToast(duration)", type: "number", defaultValue: "2500" },
            { prop: "Toast.title", type: "string" },
            { prop: "Toast.description", type: "string" },
            { prop: "Toast.onDismiss", type: "() => void" },
          ]}
        />
      </DocSection>

      <DocSection title="Accessibility">
        <DocLead>
          The dismiss button carries an accessibilityLabel of &quot;Dismiss&quot; — tap it to close before the
          auto-dismiss timer fires.
        </DocLead>
      </DocSection>
    </DocScreen>
  );
}
