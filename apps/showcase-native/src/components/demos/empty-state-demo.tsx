import Inbox from "lucide-react-native/icons/inbox";
import { Button, EmptyState, useNativeColors } from "@spine/ui-native";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function EmptyStateDemo() {
  const colors = useNativeColors();

  return (
    <>
      <DemoLead>Icon, title, optional description, and optional action — for a zero-results screen.</DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <EmptyState
            icon={<Inbox size={28} color={colors.onSurfaceMuted} />}
            title="No invoices yet"
            description="Invoices you issue will show up here."
            action={
              <Button variant="primary" onPress={() => {}}>
                Create invoice
              </Button>
            }
          />
        </DemoPreview>
      </DemoSection>
    </>
  );
}
