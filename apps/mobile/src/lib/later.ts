import { Alert } from "react-native";

/**
 * Field work that lands later in Phase 5 (photos, expenses, milestone
 * completion, presenting quotes — US-MOB-11 to US-MOB-17). Its buttons are
 * drawn now so the screens match the designs; until then they say so.
 */
export const LATER_MESSAGE = "This arrives in the next update of Spine on your phone. Use Spine on a computer for now.";

export function arrivesLater(action: string): void {
  Alert.alert(action, LATER_MESSAGE);
}
