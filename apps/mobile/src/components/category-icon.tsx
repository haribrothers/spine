import Fuel from "lucide-react-native/icons/fuel";
import HardHat from "lucide-react-native/icons/hard-hat";
import Package from "lucide-react-native/icons/package";
import ReceiptText from "lucide-react-native/icons/receipt-text";
import Utensils from "lucide-react-native/icons/utensils";
import Wrench from "lucide-react-native/icons/wrench";

/** An icon for an expense category by its name, as the designs draw them; a receipt otherwise. */
export function categoryIcon(name: string | null | undefined): React.ComponentType<{ size?: number; color?: string }> {
  const n = (name ?? "").toLowerCase();
  if (/fuel|vehicle|travel|mileage/.test(n)) return Fuel;
  if (/meal|food|subsistence/.test(n)) return Utensils;
  if (/material|supplies/.test(n)) return Package;
  if (/tool|equipment|plant/.test(n)) return Wrench;
  if (/labour|labor|crew/.test(n)) return HardHat;
  return ReceiptText;
}
