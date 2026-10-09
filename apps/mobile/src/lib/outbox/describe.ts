import { money, type BusinessFormat } from "../format";
import type { OutboxItem } from "./types";

export type ItemIcon = "photos" | "expense" | "milestone";

/** How an outbox item reads on Sync (US-MOB-08): "2 site photos" / "Marina office fit-out · 9:12 AM". */
export function describeItem(item: OutboxItem, format: BusinessFormat): { title: string; subtitle: string; icon: ItemIcon } {
  const at = new Date(item.status === "sent" && item.sentAt ? item.sentAt : item.createdAt).toLocaleTimeString(format.locale, { hour: "numeric", minute: "2-digit" });
  if (item.kind === "photos") {
    const n = item.payload.photos.length;
    return { title: `${n} site ${n === 1 ? "photo" : "photos"}`, subtitle: `${item.payload.jobName} · ${at}`, icon: "photos" };
  }
  if (item.kind === "expense") {
    const p = item.payload;
    return {
      title: `Expense · ${p.categoryName} · ${money(p.amount, { currency: p.currency, locale: format.locale })}`,
      subtitle: [p.jobName, at].filter(Boolean).join(" · "),
      icon: "expense",
    };
  }
  const already = item.status === "sent" && item.result?.alreadyCompleted;
  return {
    title: "Milestone completed",
    subtitle: already ? `Already completed by ${item.result?.alreadyCompletedBy ?? "someone else"}` : `${item.payload.milestoneName} · ${at}`,
    icon: "milestone",
  };
}

/** "3 items waiting", "1 item waiting". */
export function waitingTitle(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"} waiting`;
}
