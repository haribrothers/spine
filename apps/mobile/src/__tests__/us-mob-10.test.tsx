import { fireEvent, screen } from "@testing-library/react-native";
import "../test-utils/router-mock";
import { apiRequest } from "../lib/api/request";
import { AccessRemovedError, ApiError, OfflineError, ServerUnreachableError, SessionExpiredError, UpdateRequiredError } from "../lib/api/errors";
import { SERVER_ERROR_MESSAGE, SERVER_ERROR_TITLE, ServerErrorState } from "../features/errors/server-error-state";
import { UpdateRequiredScreen } from "../features/errors/update-required-screen";
import { queueExpense, queuePhotos } from "../test-utils/outbox";
import { jsonResponse, renderWithSession } from "../test-utils/session";

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const online = async () => true;
const offline = async () => false;

describe("US-MOB-10 · show a clear error when the server can't be reached", () => {
  it("sends the client version and the bearer token on every request", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await apiRequest("https://spine.example/api", "GET", "/org/members/me", { token: "t" }, online);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-Spine-Client-Version"]).toMatch(/^\d+\.\d+\.\d+/);
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(init.credentials).toBe("omit");
  });

  it("tells offline apart from a server that doesn't answer", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await expect(apiRequest("https://x/api", "GET", "/jobs", {}, offline)).rejects.toBeInstanceOf(OfflineError);
    await expect(apiRequest("https://x/api", "GET", "/jobs", {}, online)).rejects.toBeInstanceOf(ServerUnreachableError);
    fetchMock.mockResolvedValueOnce(jsonResponse(503, {}));
    await expect(apiRequest("https://x/api", "GET", "/jobs", {}, online)).rejects.toBeInstanceOf(ServerUnreachableError);
  });

  it("turns 426 CLIENT_TOO_OLD into Update required, and keeps other errors typed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(426, { error: "CLIENT_TOO_OLD", minimumVersion: "1.2.0" }));
    await expect(apiRequest("https://x/api", "GET", "/jobs", {}, online)).rejects.toBeInstanceOf(UpdateRequiredError);
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { error: "ACCESS_REMOVED", message: "Your access to Riverstone Builders was removed." }));
    await expect(apiRequest("https://x/api", "GET", "/jobs", {}, online)).rejects.toEqual(new AccessRemovedError("Your access to Riverstone Builders was removed."));
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
    await expect(apiRequest("https://x/api", "GET", "/jobs", {}, online)).rejects.toBeInstanceOf(SessionExpiredError);
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { message: "Nope" }));
    await expect(apiRequest("https://x/api", "GET", "/jobs", {}, online)).rejects.toBeInstanceOf(ApiError);
  });

  it("shows Couldn't load your jobs with Try again, and hides the saved-jobs link without a cache", () => {
    const onRetry = jest.fn();
    renderWithSession(<ServerErrorState onRetry={onRetry} />);
    expect(screen.getByText(SERVER_ERROR_TITLE)).toBeTruthy();
    expect(screen.getByText(SERVER_ERROR_MESSAGE)).toBeTruthy();
    expect(screen.queryByTestId("server-error-saved")).toBeNull();
    fireEvent.press(screen.getByTestId("server-error-retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("offers the saved jobs when there's a cache", () => {
    renderWithSession(<ServerErrorState onRetry={jest.fn()} savedAt="7:42 AM" onShowSaved={jest.fn()} />);
    expect(screen.getByTestId("server-error-saved")).toBeTruthy();
  });

  it("shows Update Spine to keep going, and the waiting items it keeps", async () => {
    await queuePhotos();
    await queueExpense();
    renderWithSession(<UpdateRequiredScreen />);
    expect(screen.getByText("Update Spine to keep going")).toBeTruthy();
    expect(screen.getByText("Your company's Spine server needs a newer version of this app. It only takes a minute.")).toBeTruthy();
    expect(screen.getByText(/3 items waiting to send are kept on this phone and sent after you update\./)).toBeTruthy();
    expect(screen.getByTestId("update-open-store")).toBeTruthy();
  });
});
