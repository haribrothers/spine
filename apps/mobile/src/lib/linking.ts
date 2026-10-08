import { Linking, Platform } from "react-native";

/** Opens the phone's dialler (US-MOB-03 "Call <name>"). */
export function callNumber(phone: string): Promise<void> {
  return Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`);
}

/** The maps app at a site address: Apple Maps on iOS, the geo: handler (Google Maps) on Android. */
export function directionsUrl(address: string, os: typeof Platform.OS = Platform.OS): string {
  const q = encodeURIComponent(address.replace(/\s*\n\s*/g, ", "));
  return os === "ios" ? `maps://?daddr=${q}` : `geo:0,0?q=${q}`;
}

export function openDirections(address: string): Promise<void> {
  return Linking.openURL(directionsUrl(address));
}
