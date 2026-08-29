import { render } from "@testing-library/react";
import { FileText, Send, XCircle } from "lucide-react";
import { describe, it } from "vitest";
import { expectNoA11yViolations } from "../test/a11y";
import { Timeline, type TimelineItemData } from "./timeline";

const items: TimelineItemData[] = [
  {
    id: "1",
    icon: <FileText size={14} aria-hidden="true" />,
    title: "Quote QT-2026-014 created",
    description: "Bay 3 extension — Riverbend Fabrication.",
    timestamp: "3 days ago",
  },
  {
    id: "2",
    icon: <Send size={14} aria-hidden="true" />,
    title: "Quote QT-2026-014 sent",
    timestamp: "2 days ago",
    tone: "success",
  },
  {
    id: "3",
    icon: <XCircle size={14} aria-hidden="true" />,
    title: "Quote QT-2026-014 rejected",
    description: "Client requested a revised timeline.",
    timestamp: "1 day ago",
    tone: "critical",
  },
];

describe("Timeline a11y", () => {
  it("has no violations", async () => {
    const { container } = render(<Timeline items={items} />);
    await expectNoA11yViolations(container);
  });
});
