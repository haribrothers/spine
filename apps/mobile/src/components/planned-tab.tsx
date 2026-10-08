import { ScrollView } from "react-native";
import Briefcase from "lucide-react-native/icons/briefcase";
import Receipt from "lucide-react-native/icons/receipt";
import Search from "lucide-react-native/icons/search";
import { EmptyState, useNativeColors } from "@spine/ui-native";

const ICONS = { briefcase: Briefcase, receipt: Receipt, search: Search };

/**
 * A tab whose screen arrives in a later Phase 5 group (Jobs and Search in
 * Group 2, Expenses in Group 4). It says what the tab will hold rather than
 * pretending to be empty.
 */
export function PlannedTab({ icon, title, description }: { icon: keyof typeof ICONS; title: string; description: string }) {
  const colors = useNativeColors();
  const Icon = ICONS[icon];
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1 bg-background dark:bg-background-dark" contentContainerClassName="pt-24">
      <EmptyState icon={<Icon size={28} color={colors.onSurfaceMuted} />} title={title} description={description} />
    </ScrollView>
  );
}
