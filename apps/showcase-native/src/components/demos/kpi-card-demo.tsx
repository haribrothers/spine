import { View } from "react-native";
import { KpiCard } from "@spine/ui-native";
import Wallet from "lucide-react-native/icons/wallet";
import ClipboardList from "lucide-react-native/icons/clipboard-list";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function KpiCardDemo() {
  return (
    <>
      <DemoLead>
        A gradient-filled stat card — label, value, trend, and an icon. See Home's KPI carousel for this in real use;
        this component itself has no carousel logic, just the card.
      </DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <View className="flex-row gap-3">
            <KpiCard
              label="Outstanding"
              value="$42,300"
              trend="+8% this month"
              icon={Wallet}
              gradient={{ from: "#2954E5", to: "#2144BB" }}
              gradientId="demo-primary"
            />
            <KpiCard
              label="Jobs in progress"
              value="6"
              trend="2 due this week"
              icon={ClipboardList}
              gradient={{ from: "#9A6300", to: "#7E5100" }}
              gradientId="demo-due-soon"
            />
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
