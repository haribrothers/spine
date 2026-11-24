import { act, fireEvent, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { mockRouter } from "../test-utils/router-mock";
import { renderWithSession } from "../test-utils/session";
import { PRESENTED } from "../test-utils/quotes";
import { QUOTES } from "../test-utils/fixtures";
import { cache } from "../lib/cache/cache-store";
import { connectivity } from "../lib/connectivity";
import { quotesKey } from "../lib/data/jobs";
import { presentation } from "../lib/data/quotes";
import { HAND_OVER, PresentScreen } from "../features/quotes/present-screen";
import { DECLINE_OFFLINE, DeclineSheet, REASON_PLACEHOLDER, declineMessage } from "../features/quotes/decline-sheet";
import { htmlToText } from "../features/quotes/quote-format";
import type { SessionContextValue } from "../lib/session/session-provider";

const asRequest = (fn: jest.Mock) => fn as unknown as SessionContextValue["request"];
const serving = (quote = PRESENTED) => jest.fn(async (method: string, path: string) => (method === "GET" && path === `/quotes/${quote.id}` ? quote : {}));

describe("US-MOB-16 · present a quote to the customer on my phone", () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    connectivity.set(true);
  });
  afterEach(() => {
    Platform.OS = "ios";
    presentation.end(PRESENTED.id);
  });

  it("opens full-screen with the hand-over note, the business, QUOTE <number>, who it's for, valid until, lines, subtotal, each tax, total and notes", async () => {
    renderWithSession(<PresentScreen id="q-4" jobId="job-1" onClose={jest.fn()} />, { request: asRequest(serving()) });
    expect(await screen.findByText("Riverstone Builders")).toBeTruthy();
    expect(screen.getByText(HAND_OVER)).toBeTruthy();
    expect(HAND_OVER).toBe("Hand the phone to your customer");
    expect(screen.getByText("220 Timberline Ave, Suite 4, Burlington, VT 05401")).toBeTruthy();
    expect(screen.getByText("Quote")).toBeTruthy();
    expect(screen.getByText("QUO-0004")).toBeTruthy();
    expect(screen.getByText("Prepared for")).toBeTruthy();
    expect(screen.getByText("Harborview Construction Co.")).toBeTruthy();
    expect(screen.getByText("Valid until")).toBeTruthy();
    expect(screen.getByText("Oct 17, 2026")).toBeTruthy();
    expect(screen.getByText("Additional electrical outlets (site-requested)")).toBeTruthy();
    expect(screen.getByText("6 × $85.00")).toBeTruthy();
    expect(screen.getByText("Subtotal")).toBeTruthy();
    expect(screen.getByText("Sales Tax (15%)")).toBeTruthy();
    expect(screen.getByText("$76.50")).toBeTruthy();
    expect(screen.getByText("State Surcharge (2.5%)")).toBeTruthy();
    expect(screen.getByText("$14.66")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getByText("$601.16")).toBeTruthy();
    expect(screen.getByText("NOTES")).toBeTruthy();
    expect(screen.getByText("Additional scope requested on site — see attached line items.")).toBeTruthy();
  });

  it("offers Decline and Accept quote at the bottom, and Done goes back to the job", async () => {
    const onClose = jest.fn();
    renderWithSession(<PresentScreen id="q-4" jobId="job-1" onClose={onClose} />, { request: asRequest(serving()) });
    await screen.findByText("Riverstone Builders");
    fireEvent.press(screen.getByText("Accept quote"));
    expect(mockRouter.push).toHaveBeenCalledWith("/quote/q-4/accept");
    fireEvent.press(screen.getByText("Decline"));
    expect(mockRouter.push).toHaveBeenCalledWith("/quote/q-4/decline");
    fireEvent.press(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalled();
    expect(presentation.get("q-4")).toMatchObject({ quote: { number: "QUO-0004" }, jobId: "job-1" });
  });

  it("on Android: ✕ and the number in the bar, an outlined card, and Notes in the primary colour", async () => {
    Platform.OS = "android";
    renderWithSession(<PresentScreen id="q-4" onClose={jest.fn()} />, { request: asRequest(serving()) });
    expect(await screen.findByText("QUO-0004")).toBeTruthy();
    expect(screen.getByLabelText("Done")).toBeTruthy();
    expect(screen.queryByText("Quote")).toBeNull();
    expect(screen.getByText("Notes")).toBeTruthy();
  });

  it("shows CGST and SGST as the server sends them for an Indian quote", async () => {
    const india = { ...PRESENTED, taxLines: [{ label: "CGST (9%)", amount: "4590" }, { label: "SGST (9%)", amount: "4590" }] };
    renderWithSession(<PresentScreen id="q-4" onClose={jest.fn()} />, { request: asRequest(serving(india)) });
    expect(await screen.findByText("CGST (9%)")).toBeTruthy();
    expect(screen.getByText("SGST (9%)")).toBeTruthy();
  });

  it("strips the notes' rich text to plain paragraphs", () => {
    expect(htmlToText("<p>Line one &amp; two</p><ul><li>Cabinets</li></ul>")).toBe("Line one & two\n• Cabinets");
  });

  describe("Decline", () => {
    it("says who's declining what for how much and that the office is told, with Reason (optional)", () => {
      renderWithSession(<DeclineSheet quote={PRESENTED} onCancel={jest.fn()} onDeclined={jest.fn()} />);
      expect(screen.getByText("Harborview Construction Co. is declining QUO-0004 for $601.16. Riverstone Builders' office is told straight away.")).toBeTruthy();
      expect(declineMessage("Acme", "QUO-1", "$1.00", "Northside Plumbing")).toBe("Acme is declining QUO-1 for $1.00. Northside Plumbing's office is told straight away.");
      expect(screen.getByText("Reason (optional)")).toBeTruthy();
      expect(screen.getByTestId("decline-reason").props.placeholder).toBe(REASON_PLACEHOLDER);
      expect(screen.getByText("Decline quote")).toBeTruthy();
    });

    it("records the decline with the reason, takes the quote off the job and closes", async () => {
      await cache.write(quotesKey("job-1"), QUOTES);
      presentation.start(PRESENTED, "job-1");
      const request = jest.fn(async () => ({ ...PRESENTED, status: "rejected" }));
      const onDeclined = jest.fn();
      renderWithSession(<DeclineSheet quote={PRESENTED} onCancel={jest.fn()} onDeclined={onDeclined} />, { request: asRequest(request) });
      fireEvent.changeText(screen.getByTestId("decline-reason"), "The timing doesn't work");
      await act(async () => fireEvent.press(screen.getByTestId("decline-confirm")));
      expect(request).toHaveBeenCalledWith("POST", "/quotes/q-4/reject-in-person", expect.objectContaining({ body: { comment: "The timing doesn't work" }, idempotencyKey: expect.any(String) }));
      expect(onDeclined).toHaveBeenCalled();
      expect((await cache.read(quotesKey("job-1")))!.value).toEqual([]);
    });

    it("offline: notes it needs a connection and keeps Decline quote off", async () => {
      connectivity.set(false);
      const request = jest.fn();
      renderWithSession(<DeclineSheet quote={PRESENTED} onCancel={jest.fn()} onDeclined={jest.fn()} />, { request: asRequest(request) });
      expect(screen.getByText(DECLINE_OFFLINE)).toBeTruthy();
      expect(DECLINE_OFFLINE).toBe("Needs a connection — declining can't be saved offline.");
      await act(async () => fireEvent.press(screen.getByTestId("decline-confirm")));
      expect(request).not.toHaveBeenCalled();
    });

    it("on Android: the title in the sheet, an outlined reason, and Cancel beside Decline quote", () => {
      Platform.OS = "android";
      const onCancel = jest.fn();
      renderWithSession(<DeclineSheet quote={PRESENTED} onCancel={onCancel} onDeclined={jest.fn()} />);
      expect(screen.getAllByText("Decline quote")).toHaveLength(2);
      fireEvent.press(screen.getByTestId("decline-cancel"));
      expect(onCancel).toHaveBeenCalled();
    });
  });
});
