import { inflateSync } from "node:zlib";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { ACCEPTED, PRESENTED } from "../test-utils/quotes";
import { QUOTES } from "../test-utils/fixtures";
import { cache } from "../lib/cache/cache-store";
import { connectivity } from "../lib/connectivity";
import { quotesKey } from "../lib/data/jobs";
import { presentation } from "../lib/data/quotes";
import { encodePng, hasSignature, rasterize } from "../lib/signature/png";
import { SignaturePad } from "../components/signature-pad";
import { AcceptScreen, NAME_HINT, SIGN_HINT, acceptStatement } from "../features/quotes/accept-screen";
import { AcceptedScreen, METHOD_ON_PHONE, acceptedMessage } from "../features/quotes/accepted-screen";
import type { SessionContextValue } from "../lib/session/session-provider";


const asRequest = (fn: jest.Mock) => fn as unknown as SessionContextValue["request"];
const SIGNATURE = [
  [
    { x: 10, y: 60 },
    { x: 40, y: 20 },
    { x: 80, y: 70 },
  ],
];

/** The customer signs: what the pad hands the screen when a finger lifts. */
async function sign() {
  const pad = screen.UNSAFE_getByType(SignaturePad);
  await act(async () => {
    pad.props.onSize({ width: 300, height: 160 });
    pad.props.onChange(SIGNATURE);
  });
}

describe("US-MOB-17 · capture the customer's acceptance and signature", () => {
  beforeEach(() => {
    connectivity.set(true);
  });
  afterEach(() => {
    Platform.OS = "ios";
    presentation.end(PRESENTED.id);
  });

  it("shows the customer and total, Your name, SIGN BELOW with Clear, the statement naming me, and Accept and sign", () => {
    renderWithSession(<AcceptScreen quote={PRESENTED} onBack={jest.fn()} onAccepted={jest.fn()} />);
    expect(screen.getByText("Accept QUO-0004")).toBeTruthy();
    expect(screen.getByText("Customer")).toBeTruthy();
    expect(screen.getByText("Harborview Construction Co.")).toBeTruthy();
    expect(screen.getByTestId("accept-total").props.children).toBe("$601.16");
    expect(screen.getByText("Your name")).toBeTruthy();
    expect(screen.getByText("Sign below")).toBeTruthy();
    expect(screen.getByText("Clear")).toBeTruthy();
    expect(screen.getByTestId("accept-statement").props.children).toBe(
      "By signing, I accept this quote for $601.16 on behalf of Harborview Construction Co. Spine records your signature, the time and the Riverstone Builders staff member present (Marcus Webb).",
    );
    expect(acceptStatement("$1.00", "Acme", "Bob Builds", "Sam")).toContain("(Sam)");
    expect(screen.getByText("Accept and sign")).toBeTruthy();
  });

  it("keeps Accept and sign off with a hint until there's a name and a signature", async () => {
    const request = jest.fn();
    renderWithSession(<AcceptScreen quote={PRESENTED} onBack={jest.fn()} onAccepted={jest.fn()} />, { request: asRequest(request) });
    expect(screen.getByTestId("accept-hint").props.children).toBe(NAME_HINT);
    fireEvent.changeText(screen.getByTestId("accept-name"), "Alan Reyes");
    expect(screen.getByTestId("accept-hint").props.children).toBe(SIGN_HINT);
    expect(SIGN_HINT).toBe("Sign in the box to continue.");
    await act(async () => fireEvent.press(screen.getByText("Accept and sign")));
    expect(request).not.toHaveBeenCalled();
    await sign();
    expect(screen.queryByTestId("accept-hint")).toBeNull();
    fireEvent.press(screen.getByTestId("signature-clear"));
    expect(screen.getByTestId("accept-hint").props.children).toBe(SIGN_HINT);
  });

  it("uploads the signature as a PNG, records the acceptance with the name, takes the quote off the job and shows Quote accepted", async () => {
    await cache.write(quotesKey("job-1"), QUOTES);
    presentation.start(PRESENTED, "job-1");
    const write = jest.spyOn(File.prototype, "write");
    const request = jest.fn(async (method: string, path: string) => (path === "/files" ? { id: "file-1" } : ACCEPTED));
    const onAccepted = jest.fn();
    renderWithSession(<AcceptScreen quote={PRESENTED} onBack={jest.fn()} onAccepted={onAccepted} />, { request: asRequest(request) });
    fireEvent.changeText(screen.getByTestId("accept-name"), " Alan Reyes ");
    await sign();
    await act(async () => fireEvent.press(screen.getByText("Accept and sign")));
    expect(request).toHaveBeenCalledWith("POST", "/files", expect.objectContaining({ formData: expect.anything(), idempotencyKey: expect.any(String) }));
    expect(request).toHaveBeenCalledWith("POST", "/quotes/q-4/accept-in-person", expect.objectContaining({ body: { signatureFileId: "file-1", signerName: "Alan Reyes" } }));
    expect([...(write.mock.calls[0]![0] as Uint8Array).slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(onAccepted).toHaveBeenCalledWith(ACCEPTED);
    expect(presentation.get("q-4")!.answer).toEqual(ACCEPTED);
    expect((await cache.read(quotesKey("job-1")))!.value).toEqual([]);
  });

  it("on Android: an outlined Your name field", () => {
    Platform.OS = "android";
    renderWithSession(<AcceptScreen quote={PRESENTED} onBack={jest.fn()} onAccepted={jest.fn()} />);
    expect(screen.UNSAFE_getByProps({ testID: "accept-name" }).props.label).toBe("Your name");
  });

  it("says Quote accepted, <number> · <total>, who signed when, that the office was told, the witness and the method, with Back to job", () => {
    const onDone = jest.fn();
    renderWithSession(<AcceptedScreen quote={ACCEPTED} onDone={onDone} />);
    expect(screen.getByText("Quote accepted")).toBeTruthy();
    expect(screen.getByText("QUO-0004 · $601.16")).toBeTruthy();
    const at = new Date(ACCEPTED.respondedAt!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    expect(screen.getByTestId("accepted-message").props.children).toBe(`Signed by Alan Reyes at ${at}. Riverstone Builders' office has been told and the quote is now locked.`);
    expect(acceptedMessage("Alan Reyes", "10:42 AM", "Riverstone Builders")).toBe("Signed by Alan Reyes at 10:42 AM. Riverstone Builders' office has been told and the quote is now locked.");
    expect(screen.getByText("Witnessed by")).toBeTruthy();
    expect(screen.getByText("Marcus Webb")).toBeTruthy();
    expect(screen.getByText(METHOD_ON_PHONE)).toBeTruthy();
    fireEvent.press(screen.getByText("Back to job"));
    expect(onDone).toHaveBeenCalled();
  });

  it("draws the signature dark on white into a valid 1-bit PNG", () => {
    const png = encodePng(rasterize(SIGNATURE, { width: 100, height: 80 }, { scale: 2 }));
    const view = new DataView(png.buffer);
    expect(view.getUint32(16)).toBe(200);
    expect(view.getUint32(20)).toBe(160);
    expect([png[24], png[25]]).toEqual([1, 0]); // 1-bit greyscale
    const idatLength = view.getUint32(33);
    const raw = inflateSync(Buffer.from(png.subarray(41, 41 + idatLength)));
    const rowBytes = Math.ceil(200 / 8) + 1;
    expect(raw.length).toBe(rowBytes * 160);
    const pixel = (x: number, y: number) => (raw[y * rowBytes + 1 + (x >> 3)]! >> (7 - (x & 7))) & 1;
    expect(pixel(0, 0)).toBe(1); // white paper
    expect(pixel(80, 40)).toBe(0); // ink on the stroke from (40,20) at scale 2
    expect(hasSignature(SIGNATURE)).toBe(true);
    expect(hasSignature([[{ x: 1, y: 1 }]])).toBe(false);
  });
});
