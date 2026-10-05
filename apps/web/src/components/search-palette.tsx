"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette, type CommandPaletteGroup } from "@spine/ui";
import { SEARCH_MIN_LENGTH, type SearchResponse } from "@spine/shared";
import { Search } from "lucide-react";
import { apiClient } from "../lib/api-client";

/** Wait this long after the last keystroke before asking the server. */
const DEBOUNCE_MS = 150;

/**
 * US-OPS-22/23 (D-095) — search everything from anywhere: ⌘K / Ctrl+K or
 * the search button opens the palette with focus in the field; from 2
 * characters it shows contacts, quotes, jobs, invoices, vendor bills and
 * expenses the member can read (`GET /search`), 5 each. Enter opens the
 * highlighted record; Escape closes and returns focus.
 */
export function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const hrefs = useRef(new Map<string, string>());
  const latest = useRef(0);

  // ⌘K / Ctrl+K anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  // A fresh palette each time it opens.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResult(null);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < SEARCH_MIN_LENGTH) {
      setResult(null);
      setLoading(false);
      return;
    }
    const request = ++latest.current;
    setLoading(true);
    const timer = setTimeout(() => {
      apiClient
        .get<SearchResponse>(`/search?q=${encodeURIComponent(q)}&limit=5`)
        .then((res) => {
          if (request === latest.current) setResult(res);
        })
        .catch(() => {
          if (request === latest.current) setResult({ query: q, groups: [] });
        })
        .finally(() => {
          if (request === latest.current) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  hrefs.current = new Map((result?.groups ?? []).flatMap((g) => g.items.map((i) => [`${g.type}:${i.id}`, i.href] as const)));
  const groups: CommandPaletteGroup[] = (result?.groups ?? []).map((g) => ({
    heading: g.label,
    items: g.items.map((i) => ({ id: `${g.type}:${i.id}`, title: i.title, subtitle: i.subtitle, meta: i.status })),
  }));
  const q = query.trim();

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      label="Search"
      query={query}
      onQueryChange={setQuery}
      placeholder="Search contacts, quotes, invoices, jobs, bills and expenses"
      groups={groups}
      loading={loading}
      hint={q.length < SEARCH_MIN_LENGTH ? "Type at least 2 characters, or a number like INV-0010." : undefined}
      emptyMessage={result && q.length >= SEARCH_MIN_LENGTH ? `No results for “${q}”` : undefined}
      onSelect={(item) => {
        const href = hrefs.current.get(item.id);
        onOpenChange(false);
        if (href) router.push(href);
      }}
      footer={
        <>
          <span>↑↓ to move</span>
          <span>Enter to open</span>
          <span className="ml-auto">Searches contacts, quotes, invoices, jobs, bills and expenses</span>
        </>
      }
    />
  );
}

/** The sidebar's search button (beside Help and Notifications — the app's only persistent chrome). */
export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search (⌘K)"
      aria-keyshortcuts="Meta+K Control+K"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Search size={16} />
    </button>
  );
}
