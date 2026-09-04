import { Text } from "react-native";
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@spine/ui-native";
import { DemoLead, DemoSection } from "../demo-screen";

export function CardDemo() {
  return (
    <>
      <DemoLead>A grouping container with composable sub-parts — use only the ones a given card needs.</DemoLead>
      <DemoSection title="Default">
        <Card>
          <CardHeader>
            <CardTitle>Invoice INV-2026-0042</CardTitle>
            <CardDescription>Issued 5 Aug 2026, due 19 Aug 2026</CardDescription>
          </CardHeader>
          <CardContent>
            <Text className="text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
              Acme Contracting Ltd. — $1,240.00
            </Text>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" onPress={() => {}}>
              View
            </Button>
          </CardFooter>
        </Card>
      </DemoSection>
    </>
  );
}
