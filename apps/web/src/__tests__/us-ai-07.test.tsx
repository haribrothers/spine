import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_UNAVAILABLE_MESSAGE, aiPausedMessage } from "@spine/shared";

const state = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../lib/api-client", async (original) => ({ ...(await original<typeof import("../lib/api-client")>()), apiClient: { post: state.post } }));

import { ApiError, apiClient } from "../lib/api-client";
import { fillEmpty } from "../lib/ai-fill";
import { useAiRequest } from "../lib/use-ai-request";
import { AiActionButton } from "../components/ai-action-button";
import { AiUnavailableNotice } from "../components/ai-unavailable-notice";

type Bill = { vendor: string; billNumber: string; dueDate: string };

/** A bill-like form with one AI control, wired the way every AI feature is. */
function BillForm({ onSave }: { onSave: (bill: Bill) => void }) {
  const [values, setValues] = useState<Bill>({ vendor: "", billNumber: "", dueDate: "" });
  const ai = useAiRequest<Partial<Bill>>();
  const read = () =>
    void ai.run(
      (signal) => apiClient.post<Partial<Bill>>("/ai/read-document", { fileId: "f1", target: "vendor_bill" }, { signal }),
      (suggestion) => setValues((current) => fillEmpty(current, suggestion).next),
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(values);
      }}
    >
      {ai.state.status === "failed" && <AiUnavailableNotice message={ai.state.message} detail="RTE-3318.pdf is attached either way." onRetry={ai.state.canRetry ? ai.retry : undefined} />}
      <AiActionButton label="Read from document" workingLabel="Reading…" working={ai.working} onClick={read} onCancel={ai.cancel} />
      {(["vendor", "billNumber", "dueDate"] as const).map((key) => (
        <label key={key}>
          {key}
          <input value={values[key]} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />
        </label>
      ))}
      <button type="submit">Save as draft</button>
    </form>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });

beforeEach(() => state.post.mockReset());

describe("US-AI-07", () => {
  it("when AI doesn't answer, says so by the control with \"Try again\", and keeps what I entered", async () => {
    state.post.mockRejectedValueOnce(new ApiError(AI_UNAVAILABLE_MESSAGE, 504, { error: "AI_TIMEOUT" }));
    render(<BillForm onSave={vi.fn()} />);
    type("vendor", "Ridgeline Equipment Rentals");
    fireEvent.click(screen.getByRole("button", { name: "Read from document" }));
    const notice = await screen.findByTestId("ai-unavailable");
    expect((notice).textContent).toContain("AI didn't answer. Fill this in by hand or try again. RTE-3318.pdf is attached either way.");
    expect(notice.getAttribute("role")).toBe("alert");
    expect(field("vendor").value).toBe("Ridgeline Equipment Rentals");

    state.post.mockResolvedValueOnce({ billNumber: "RTE-3318" });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(field("billNumber").value).toBe("RTE-3318"));
    expect(screen.queryByTestId("ai-unavailable")).toBeNull();
    expect(state.post).toHaveBeenCalledTimes(2);
  });

  it("with the provider down, the form saves by hand", async () => {
    state.post.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const onSave = vi.fn();
    render(<BillForm onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Read from document" }));
    expect((await screen.findByTestId("ai-unavailable")).textContent).toContain("AI didn't answer.");
    type("billNumber", "RTE-3318");
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(onSave).toHaveBeenCalledWith({ vendor: "", billNumber: "RTE-3318", dueDate: "" });
  });

  it("a paused budget says so, without \"Try again\"", async () => {
    state.post.mockRejectedValueOnce(new ApiError(aiPausedMessage("2026-11-01"), 409, { error: "AI_BUDGET_USED" }));
    render(<BillForm onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Read from document" }));
    expect((await screen.findByTestId("ai-unavailable")).textContent).toContain("AI is paused until");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("while it works I can keep typing, and what I typed isn't overwritten", async () => {
    const answer = deferred<Partial<Bill>>();
    state.post.mockReturnValueOnce(answer.promise);
    render(<BillForm onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Read from document" }));
    expect((screen.getByRole("button", { name: "Reading…" }) as HTMLButtonElement).disabled).toBe(true);
    type("billNumber", "RTE-3318-A");
    await act(async () => answer.resolve({ vendor: "Ridgeline Equipment Rentals", billNumber: "RTE-3318", dueDate: "2026-11-05" }));
    expect(field("billNumber").value).toBe("RTE-3318-A");
    expect(field("vendor").value).toBe("Ridgeline Equipment Rentals");
    expect(field("dueDate").value).toBe("2026-11-05");
    expect((screen.getByRole("button", { name: "Read from document" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("\"Cancel\" stops the request and it fills nothing", async () => {
    const answer = deferred<Partial<Bill>>();
    state.post.mockReturnValueOnce(answer.promise);
    render(<BillForm onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Read from document" }));
    const signal = (state.post.mock.calls[0]![2] as { signal: AbortSignal }).signal;
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(signal.aborted).toBe(true);
    await act(async () => answer.resolve({ vendor: "Ridgeline Equipment Rentals" }));
    expect(field("vendor").value).toBe("");
    expect((screen.getByRole("button", { name: "Read from document" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("ai-unavailable")).toBeNull();
  });

  it("a field Spine couldn't use stays empty and the rest fill", () => {
    // The API leaves out a field that fails its check (fit-reply.ts); the form only fills what came back.
    const current = { vendor: "", billNumber: "", dueDate: "" };
    expect(fillEmpty(current, { vendor: "Ridgeline Equipment Rentals", dueDate: "" })).toEqual({ next: { ...current, vendor: "Ridgeline Equipment Rentals" }, filled: ["vendor"], kept: [] });
    expect(fillEmpty({ ...current, billNumber: "RTE-1" }, { billNumber: "RTE-3318" }).kept).toEqual(["billNumber"]);
  });
});
