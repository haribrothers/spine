import { act, fireEvent, screen } from "@testing-library/react-native";
import { Linking, Platform } from "react-native";
import { mockCameraPermission, grantCamera } from "../test-utils/camera-mock";
import { mockRouter } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { CameraScreen } from "../features/camera/camera-screen";
import { CAMERA_MESSAGE, CAMERA_REASONS, CAMERA_TITLE, SETTINGS_HINT } from "../features/camera/camera-permission";
import type { PermissionResponse } from "expo-camera";

const undetermined = { granted: false, status: "undetermined", canAskAgain: true, expires: "never" } as PermissionResponse;
const deniedForGood = { granted: false, status: "denied", canAskAgain: false, expires: "never" } as PermissionResponse;

describe("US-MOB-14 · ask for camera access with a reason", () => {
  beforeEach(() => {
    mockRouter.back.mockClear();
    mockCameraPermission.request.mockReset();
  });
  afterEach(() => {
    grantCamera();
    Platform.OS = "ios";
    jest.restoreAllMocks();
  });

  it("explains before the system asks: the title, why, and three reasons", () => {
    mockCameraPermission.current = undetermined;
    renderWithSession(<CameraScreen mode="photos" />);
    expect(screen.getByText(CAMERA_TITLE)).toBeTruthy();
    expect(CAMERA_TITLE).toBe("Allow camera access");
    expect(screen.getByText(CAMERA_MESSAGE)).toBeTruthy();
    expect(CAMERA_MESSAGE).toBe("Spine uses the camera for site photos and receipt pictures. Photos go only to your company's Spine server — never anywhere else.");
    for (const reason of CAMERA_REASONS) expect(screen.getByText(reason)).toBeTruthy();
    expect(CAMERA_REASONS).toHaveLength(3);
    expect(screen.queryByTestId("camera-view")).toBeNull();
  });

  it("opens the camera once Continue is allowed", async () => {
    mockCameraPermission.current = undetermined;
    mockCameraPermission.request.mockResolvedValue({ granted: true, status: "granted", canAskAgain: true, expires: "never" });
    renderWithSession(<CameraScreen mode="photos" />);
    await act(async () => fireEvent.press(screen.getByTestId("camera-permission-continue")));
    expect(mockCameraPermission.request).toHaveBeenCalled();
    expect(screen.getByTestId("camera-view")).toBeTruthy();
  });

  it("goes back to where I was with Not now", () => {
    mockCameraPermission.current = undetermined;
    renderWithSession(<CameraScreen mode="receipt" />);
    fireEvent.press(screen.getByTestId("camera-permission-not-now"));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("says where to turn it on after a no, and opens Settings when the system won't ask again", () => {
    mockCameraPermission.current = deniedForGood;
    const settings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    renderWithSession(<CameraScreen mode="photos" />);
    expect(screen.getByTestId("camera-permission-hint").props.children).toBe("Said no before? Turn it on in Settings › Spine › Camera.");
    fireEvent.press(screen.getByTestId("camera-permission-continue"));
    expect(settings).toHaveBeenCalled();
    expect(mockCameraPermission.request).not.toHaveBeenCalled();
    expect(SETTINGS_HINT.android).toBe("Said no before? Turn it on in Settings › Apps › Spine › Permissions.");
  });

  it("keeps the purpose strings in the app config", () => {
    const app = jest.requireActual("../../app.json") as { expo: { plugins: unknown[] } };
    const picker = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === "expo-image-picker") as [string, { cameraPermission: string; photosPermission: string }];
    expect(picker[1].cameraPermission).toMatch(/camera for site photos and receipts/);
    expect(picker[1].photosPermission).toMatch(/Only the photo you pick is used/);
  });
});
