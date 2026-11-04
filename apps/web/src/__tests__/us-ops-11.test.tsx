import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", async (importActual) => ({ ...(await importActual<object>()), useRouter: () => router }));

import { ApiError } from "../lib/api-client";
import { useLoadFailure } from "../lib/use-load-failure";
import { NOT_FOUND_MESSAGE, NotFoundView } from "../components/not-found-view";

const ID = "6f1c2b8e-3d4a-4b5c-8e9f-0a1b2c3d4e5f";
/** What Next.js's notFound() throws, for the nearest not-found.tsx. */
const isNotFound = (err: unknown) => String((err as { digest?: string })?.digest ?? "").includes("404");

describe("US-OPS-11 · show a helpful page for a missing page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says 404, that the page can't be found, and that financial documents are never deleted", () => {
    render(<NotFoundView />);
    expect(screen.getByText("404")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "We can't find that page" })).toBeTruthy();
    expect(screen.getByText(NOT_FOUND_MESSAGE)).toBeTruthy();
    expect(NOT_FOUND_MESSAGE).toBe(
      "The link may be wrong, or the record may have been deleted. Financial documents are never deleted — if you followed a link to an invoice, check its number in Invoices.",
    );
  });

  it("Go to dashboard links to the dashboard; Go back goes back", () => {
    render(<NotFoundView />);
    expect(screen.getByRole("link", { name: "Go to dashboard" }).getAttribute("href")).toBe("/dashboard");
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(router.back).toHaveBeenCalled();
  });

  it("a record page whose id can't be a record shows the 404 page without asking the API", () => {
    let thrown: unknown;
    try {
      renderHook(() => useLoadFailure("not-a-record"));
    } catch (err) {
      thrown = err;
    }
    expect(isNotFound(thrown)).toBe(true);
  });

  it("a record that isn't in my organisation (404) shows the 404 page; other failures are the page's to say", () => {
    const errors: unknown[] = [];
    const { result } = renderHook(() => {
      try {
        return useLoadFailure(ID);
      } catch (err) {
        errors.push(err);
        throw err;
      }
    });
    const loadFailed = result.current;
    expect(loadFailed(new TypeError("Failed to fetch"))).toBe(false);
    expect(loadFailed(new ApiError("You don't have permission to do that.", 403, null))).toBe(false);
    expect(() => act(() => void loadFailed(new ApiError("Invoice not found", 404, null)))).toThrow();
    expect(errors.some(isNotFound)).toBe(true);
  });
});
