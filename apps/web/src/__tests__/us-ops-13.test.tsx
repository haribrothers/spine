import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { useLoadFailure } from "../lib/use-load-failure";
import { SERVER_ERROR_MESSAGE, ServerErrorView, errorReference } from "../components/server-error-view";

describe("US-OPS-13 · recover from an unexpected error", () => {
  it("says saved work is safe and gives the API's request id as the reference", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ServerErrorView error={new ApiError("Internal server error", 500, null, "req-7f3a9c")} />);
    expect(screen.getByRole("heading", { name: "Something went wrong on our side" })).toBeTruthy();
    expect(screen.getByText(SERVER_ERROR_MESSAGE)).toBeTruthy();
    expect(SERVER_ERROR_MESSAGE).toBe(
      "Spine couldn't finish loading this page. Nothing you entered was lost — anything you saved is still saved. Try again in a minute; if it keeps happening, send the error reference below to the person who runs your Spine server.",
    );
    expect((await screen.findByTestId("error-reference")).textContent).toBe("Error reference: req-7f3a9c");
  });

  it("without a request id, the reference is Next.js's digest, else the time", () => {
    const now = new Date("2026-11-04T10:15:00Z");
    expect(errorReference(Object.assign(new Error("boom"), { digest: "2841907153" }), now)).toBe("2841907153");
    expect(errorReference(new Error("boom"), now)).toBe("2026-11-04T10:15:00.000Z");
  });

  it("Try again reloads the page; Go to dashboard is a full page load", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    render(<ServerErrorView error={new Error("boom")} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Go to dashboard" }).getAttribute("href")).toBe("/dashboard");
    vi.unstubAllGlobals();
  });

  it("a record page whose load fails on the server shows the error page", () => {
    const failure = new ApiError("Internal server error", 500, null, "req-1");
    const thrown: unknown[] = [];
    const { result } = renderHook(() => {
      try {
        return useLoadFailure("6f1c2b8e-3d4a-4b5c-8e9f-0a1b2c3d4e5f");
      } catch (err) {
        thrown.push(err);
        throw err;
      }
    });
    expect(() => act(() => void result.current(failure))).toThrow();
    expect(thrown).toContain(failure);
  });
});
