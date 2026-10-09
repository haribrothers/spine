import type { PermissionResponse } from "expo-camera";

/** What the fake camera permission says; tests set it. */
export const mockCameraPermission: { current: PermissionResponse | null; request: jest.Mock } = {
  current: { granted: true, status: "granted", canAskAgain: true, expires: "never" } as PermissionResponse,
  request: jest.fn(),
};
let shots = 0;
export const mockTakePicture = jest.fn(async () => ({ uri: `file:///camera/shot-${++shots}.jpg`, width: 4032, height: 3024 }));

jest.mock("expo-camera", () => {
  const mockReact = jest.requireActual("react");
  const { View: MockView } = jest.requireActual("react-native");
  const CameraView = mockReact.forwardRef(function CameraView(props: object, ref: unknown) {
    mockReact.useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePicture }));
    return mockReact.createElement(MockView, { testID: "camera-view", ...props });
  });
  return {
    CameraView,
    useCameraPermissions: () => {
      const [, rerender] = mockReact.useState(0);
      return [
        mockCameraPermission.current,
        async () => {
          const next = await mockCameraPermission.request();
          if (next) mockCameraPermission.current = next;
          rerender((n: number) => n + 1);
          return mockCameraPermission.current;
        },
      ];
    },
  };
});

export function grantCamera() {
  mockCameraPermission.current = { granted: true, status: "granted", canAskAgain: true, expires: "never" } as PermissionResponse;
}
