import { View } from "react-native";
import { ActionTile, useNativeColors } from "@spine/ui-native";
import FileText from "lucide-react-native/icons/file-text";
import Wallet from "lucide-react-native/icons/wallet";
import Camera from "lucide-react-native/icons/camera";
import { DemoLead, DemoPreview, DemoSection } from "../demo-screen";

export function ActionTileDemo() {
  const colors = useNativeColors();

  return (
    <>
      <DemoLead>
        An icon + label tile, tinted rounded box — for a wrapping grid of equal-width quick actions/shortcuts. See
        Home's Quick Actions grid for this in real use.
      </DemoLead>
      <DemoSection title="Default">
        <DemoPreview>
          <View className="w-full flex-row flex-wrap gap-3">
            <ActionTile label="New quote" icon={FileText} iconColor={colors.primary} onPress={() => {}} />
            <ActionTile label="Log expense" icon={Wallet} iconColor={colors.primary} onPress={() => {}} />
            <ActionTile label="Add photo" icon={Camera} iconColor={colors.primary} onPress={() => {}} />
          </View>
        </DemoPreview>
      </DemoSection>
      <DemoSection title="Disabled">
        <DemoPreview>
          <View className="w-full flex-row flex-wrap gap-3">
            <ActionTile label="New quote" icon={FileText} iconColor={colors.primary} onPress={() => {}} disabled />
          </View>
        </DemoPreview>
      </DemoSection>
    </>
  );
}
