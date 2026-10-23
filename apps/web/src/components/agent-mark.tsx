import { Plug } from "lucide-react";

/** US-MCP-07 (D-258) — " · via Claude for Priya Raman" after an Activity entry an agent made for the person. */
export function AgentMark({ agent, person }: { agent: string; person: string | null }) {
  return (
    <>
      {" · "}
      <span className="inline-flex items-center gap-1 font-normal" data-testid="agent-made">
        <Plug size={12} aria-hidden className="text-primary" />
        via {agent}
        {person ? ` for ${person}` : ""}
      </span>
    </>
  );
}
