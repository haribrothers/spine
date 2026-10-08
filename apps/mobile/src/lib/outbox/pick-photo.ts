import { Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { outbox } from "./outbox";
import type { LocalPhoto } from "./types";

export const CAMERA_DENIED_TITLE = "Allow camera access";
export const CAMERA_DENIED_MESSAGE = "Turn on camera access for Spine in Settings to take the photo.";
export const PHOTOS_DENIED_TITLE = "Allow photo access";
export const PHOTOS_DENIED_MESSAGE = "Turn on photo access for Spine in Settings to choose a photo.";

function askForSettings(title: string, message: string) {
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Open Settings", onPress: () => void Linking.openSettings() },
  ]);
}

/**
 * Takes a photo with the camera, or picks one from the phone, then keeps a
 * compressed copy for the outbox (D-053). Null when cancelled or not allowed.
 */
export async function pickPhoto(source: "camera" | "library"): Promise<LocalPhoto | null> {
  const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    if (source === "camera") askForSettings(CAMERA_DENIED_TITLE, CAMERA_DENIED_MESSAGE);
    else askForSettings(PHOTOS_DENIED_TITLE, PHOTOS_DENIED_MESSAGE);
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return outbox.keepPhoto(asset.uri, { name: asset.fileName ?? undefined, width: asset.width, height: asset.height });
}
