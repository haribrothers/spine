import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/** A prompt is a ready-made request in the person's words, naming the tools to use. */
const ask = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

const AS_ME = "Use only Spine's tools, which act as me with my rights. Don't create, send or change anything unless I ask you to. Give each record's link so I can open it in Spine.";

/**
 * US-MCP-09 (D-259) — ready-made tasks: "Chase overdue invoices", "Summarise
 * a job", "This week in the business". Each is offered only when the tools
 * it needs were offered to this person, and its text names only those tools,
 * so running it can't reach past what the person may read.
 */
export function registerAgentPrompts(server: McpServer, tools: ReadonlySet<string>, readable: ReadonlySet<string>): void {
  const has = (name: string) => tools.has(name);

  if (has("receivables")) {
    server.registerPrompt(
      "chase_overdue_invoices",
      { title: "Chase overdue invoices", description: "Lists who owes money past its due date and suggests what to say to each, for you to send from Spine." },
      () =>
        ask(
          [
            "Help me chase overdue invoices.",
            "Use the receivables tool with age \"overdue\" to see who owes money past its due date, oldest first.",
            ...(has("get_record") && readable.has("invoice") ? ["Use get_record on an invoice when you need its lines or dates."] : []),
            "For each customer, give the invoices, the amount overdue and how many days late, then suggest a short, polite reminder in my words that I could send.",
            "Don't draft or send anything: I'll send reminders from Spine.",
            AS_ME,
          ].join("\n"),
        ),
    );
  }

  if (has("get_record") && readable.has("job")) {
    server.registerPrompt(
      "summarise_a_job",
      { title: "Summarise a job", description: "Where a job is: what's done, what's next and anything to watch.", argsSchema: { job: z.string().describe("The job's number or name") } },
      ({ job }) =>
        ask(
          [
            `Summarise the job "${job}" for me.`,
            `Find it with ${has("search") ? "search or " : ""}list_records (type "job"), then open it with get_record.`,
            "Say where it stands: its status and dates, the milestones done and to come, and what the latest notes say.",
            ...(has("job_profitability") ? ["Use the job_profitability tool for its income, costs and profit so far."] : []),
            "End with anything that needs my attention.",
            AS_ME,
          ].join("\n"),
        ),
    );
  }

  const week = [
    ...(has("dashboard_summary") ? ["the dashboard_summary tool for how the business is doing"] : []),
    ...(has("receivables") ? ["receivables for invoices that fell due or went overdue"] : []),
    ...(has("payables") ? ["payables for bills due this week"] : []),
    ...(has("bank_balances") ? ["bank_balances for what's in the bank"] : []),
    ...(has("list_records") && readable.has("job") ? ["list_records (type \"job\") for the jobs in progress"] : []),
    ...(has("list_records") && readable.has("quote") ? ["list_records (type \"quote\", status \"sent\") for quotes waiting on an answer"] : []),
  ];
  if (week.length) {
    server.registerPrompt(
      "this_week_in_the_business",
      { title: "This week in the business", description: "A short briefing on the week: what's happening and what needs doing." },
      () =>
        ask(
          [
            "Give me a short briefing on this week in the business.",
            `Use ${week.join("; ")}.`,
            "Keep it to what changed and what needs doing this week, most urgent first.",
            AS_ME,
          ].join("\n"),
        ),
    );
  }
}
