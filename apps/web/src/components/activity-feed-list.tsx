"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, cn } from "@spine/ui";
import { initialsOf, type ActivityFeedEntry } from "@spine/shared";

/** Soft avatar colours from the category tokens, picked by name so a person keeps theirs. */
const AVATAR_TONES = [
  "bg-category-blue-bg text-category-blue",
  "bg-category-amber-bg text-category-amber",
  "bg-category-green-bg text-category-green",
  "bg-category-purple-bg text-category-purple",
  "bg-category-teal-bg text-category-teal",
  "bg-category-pink-bg text-category-pink",
];

function toneFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

export function formatWhen(occurredAt: string): string {
  const d = new Date(occurredAt);
  const diffMins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * US-DASH-19 — feed rows: the actor's avatar and name in bold (a member,
 * or the customer for their own action), what happened with amounts in
 * bold, "· n times" for grouped views, and how long ago.
 */
export function ActivityFeedList({ entries }: { entries: ActivityFeedEntry[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {entries.map((entry, i) => {
        const body = (
          <div className="flex items-start gap-3 py-2.5">
            {entry.actor ? (
              <Avatar size="md" className={cn("text-[11px]", toneFor(entry.actor.name))} aria-hidden>
                <AvatarFallback>{initialsOf(entry.actor.name)}</AvatarFallback>
              </Avatar>
            ) : (
              <span className="h-8 w-8 shrink-0 rounded-full bg-surface-sunken" aria-hidden />
            )}
            <p className="min-w-0 flex-1 text-[13px] text-on-surface">
              {entry.actor && <strong className="font-semibold">{entry.actor.name} </strong>}
              {entry.parts.map((part, j) => (part.strong ? <strong key={j} className="font-semibold tabular-nums">{part.text}</strong> : <span key={j}>{part.text}</span>))}
              {entry.groupCount && entry.groupCount > 1 ? <span className="text-on-surface-muted"> · {entry.groupCount} times</span> : null}
            </p>
            <time dateTime={entry.occurredAt} className="shrink-0 text-[12px] text-on-surface-muted">
              {formatWhen(entry.occurredAt)}
            </time>
          </div>
        );
        const key = `${entry.type}-${entry.occurredAt}-${i}`;
        return (
          <li key={key} data-type={entry.type}>
            {entry.link ? (
              <Link href={entry.link} className="block rounded-sm hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
