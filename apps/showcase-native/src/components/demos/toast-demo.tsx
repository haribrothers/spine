import { Button, Toast, useToast } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function ToastDemo() {
  const { message, show, dismiss } = useToast();

  return (
    <>
      <DemoLead>An auto-dismissing confirmation message — never a validation error, that stays inline.</DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <Button
            variant="secondary"
            onPress={() => show("Invoice sent", "INV-2026-0042 was emailed to Acme Contracting Ltd.")}
          >
            Send invoice
          </Button>
        </DemoPreview>
      </DemoSection>
      {message ? <Toast title={message.title} description={message.description} onDismiss={dismiss} /> : null}
    </>
  );
}
