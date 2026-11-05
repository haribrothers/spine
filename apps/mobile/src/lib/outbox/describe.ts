import { money, type BusinessFormat } from "../format";
import type { OutboxItem } from "./types";
import { t } from "../i18n";

export type ItemIcon = "photos" | "expense" | "milestone";

/** How an outbox item reads on Sync (US-MOB-08): "2 site photos" / "Marina office fit-out · 9:12 AM". */
export function describeItem(item: OutboxItem, format: BusinessFormat): { title: string; subtitle: string; icon: ItemIcon } {
  const at = new Date(item.status === "sent" && item.sentAt ? item.sentAt : item.createdAt).toLocaleTimeString(format.locale, { hour: "numeric", minute: "2-digit" });
  if (item.kind === "photos") {
    const n = item.payload.photos.length;
    return { title: t("mobileApp.outbox.sitePhotos", { count: n }), subtitle: `${item.payload.jobName} · ${at}`, icon: "photos" };
  }
  if (item.kind === "expense") {
    const p = item.payload;
    return {
      title: t("mobileApp.outbox.expenseTitle", { category: p.categoryName, amount: money(p.amount, { currency: p.currency, locale: format.locale }) }),
      subtitle: [p.jobName, at].filter(Boolean).join(" · "),
      icon: "expense",
    };
  }
  const already = item.status === "sent" && item.result?.alreadyCompleted;
  return {
    title: t("mobileApp.outbox.milestoneCompleted"),
    subtitle: already ? t("mobileApp.outbox.alreadyCompletedBy", { name: item.result?.alreadyCompletedBy ?? t("mobileApp.outbox.someoneElse") }) : `${item.payload.milestoneName} · ${at}`,
    icon: "milestone",
  };
}

/** "3 items waiting", "1 item waiting". */
export function waitingTitle(count: number): string {
  return t("mobileApp.outbox.itemsWaiting", { count });
}
