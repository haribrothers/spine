import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentMark } from "../components/agent-mark";

describe("US-MCP-07 · a draft an agent made says so in its Activity", () => {
  it("reads “· via <Agent> for <person>”, with the icon only as decoration", () => {
    render(
      <p>
        <b>Created</b> as a draft
        <AgentMark agent="Claude" person="Priya Raman" />
      </p>,
    );
    expect(screen.getByTestId("agent-made").textContent).toBe("via Claude for Priya Raman");
    expect(document.querySelector("p")!.textContent).toBe("Created as a draft · via Claude for Priya Raman");
    expect(screen.getByTestId("agent-made").querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });
});
