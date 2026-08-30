import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Button } from "@spine/ui-native";
import { Text } from "react-native";
import { DocScreen, DocSection } from "../../src/components/doc-section";

export function CardScreen() {
  return (
    <DocScreen>
      <DocSection title="Full composition">
        <Card>
          <CardHeader>
            <CardTitle>Invoice #1024</CardTitle>
            <CardDescription>Due 12 Sep 2026</CardDescription>
          </CardHeader>
          <CardContent>
            <Text className="text-[14px] text-on-surface">$4,250.00 outstanding</Text>
          </CardContent>
          <CardFooter>
            <Button size="sm">View</Button>
          </CardFooter>
        </Card>
      </DocSection>

      <DocSection title="Content only">
        <Card>
          <CardContent>
            <Text className="text-[14px] text-on-surface">A card with no header or footer.</Text>
          </CardContent>
        </Card>
      </DocSection>
    </DocScreen>
  );
}
