import { Alert } from "react-native";

/**
 * Presenting a quote on site lands with Phase 5's last group (US-MOB-16,
 * US-MOB-17). Its button is drawn now so the job matches the design; until
 * then it says so.
 */
export const LATER_MESSAGE = "This arrives in the next update of Spine on your phone. Use Spine on a computer for now.";

export function arrivesLater(action: string): void {
  Alert.alert(action, LATER_MESSAGE);
}
