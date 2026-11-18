"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, History, Plus, Search, X } from "lucide-react";
import { Checkbox, CommandPalette, ToggleGroup, ToggleGroupItem, type AppShellNavSection, type CommandPaletteGroup, type CommandPaletteItem } from "@spine/ui";
import {
  REPORTS,
  SEARCH_GROUP_LIST_HREF,
  SEARCH_LIMIT,
  SEARCH_MIN_LENGTH,
  SEARCH_SCOPED_LIMIT,
  SEARCH_SCOPES,
  SEARCH_SCOPE_LABELS,
  canOpenReport,
  ownedByOffModule,
  parseDocumentNumber,
  type SearchGroupType,
  type SearchRecentResponse,
  type SearchResponse,
  type SearchResult,
  type SearchScope,
  type TaxProfile,
} from "@spine/shared";
import { apiClient } from "../lib/api-client";
import { useCapabilities } from "../lib/capabilities-context";
import { useModules } from "../lib/modules-context";
import { useMyRole } from "../lib/role-context";
import { pageAccessFor } from "../lib/page-access";
import { SETTINGS_GROUPS, SETTINGS_SECTIONS, searchSettings } from "./settings-dialog";
import { useOpenSettings } from "./settings-route";
import {
  PAGE_KEYWORDS,
  SEARCH_ACTIONS,
  SEARCH_GROUP_ICONS,
  SEARCH_GROUP_NOUNS,
  SEARCH_GROUP_PAGE,
  SEARCH_GROUP_SCOPE,
  actionMatches,
  matchesWordStarts,
} from "./search-actions";
import { t as translate, useT } from "../lib/i18n";

/** Wait this long after the last keystroke before asking the server. */
const DEBOUNCE_MS = 150;
/** Pages, settings and actions shown for a query, each. */
const LOCAL_MAX = 3;
/** US-OPS-46 — remembered on this device. */
const ARCHIVED_KEY = "spine.search.includeArchived";

type Scope = "all" | SearchScope;

const TONES: Record<string, CommandPaletteItem["metaTone"]> = {
  Overdue: "danger",
  Void: "danger",
  Declined: "danger",
  Rejected: "danger",
  Paid: "success",
  Accepted: "success",
  Approved: "success",
  Credited: "success",
  Won: "success",
  Sent: "warning",
  Unpaid: "warning",
  Submitted: "warning",
};

function readArchived(): boolean {
  try {
    return window.localStorage.getItem(ARCHIVED_KEY) === "1";
  } catch {
    return false;
  }
}

function resultItem(r: SearchResult, id: string): CommandPaletteItem {
  const Icon = SEARCH_GROUP_ICONS[r.type];
  return { id, title: r.title, subtitle: r.subtitle, meta: r.status, metaTone: r.status ? TONES[r.status] : undefined, icon: <Icon />, highlight: r.highlight };
}

/** "contacts, leads, meetings and expenses". */
function listOf(parts: string[]): string {
  return parts.length < 2 ? (parts[0] ?? "") : translate("common.search.listAnd", { items: parts.slice(0, -1).join(", "), last: parts[parts.length - 1] });
}

/**
 * US-OPS-22/23 (D-095), US-OPS-39 to US-OPS-49 (D-238) — search everything
 * from anywhere: ⌘K / Ctrl+K or the sidebar's search field opens the
 * palette with focus in the field. Before typing it shows recent records
 * and searches; from 2 characters, actions, pages and settings this person
 * can use, then every group they can read (`GET /search`), 5 each (20 when
 * narrowed to an area), each ending with "See all … matching". Enter opens
 * the highlighted row; Escape closes and returns focus.
 */
export function SearchPalette({
  open,
  onOpenChange,
  sections,
  isOwner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The sidebar's sections, already filtered for this person (US-OPS-41 pages, US-OPS-49 areas). */
  sections: AppShellNavSection[];
  isOwner: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const role = useMyRole();
  const field = role === "field";
  const { capabilities } = useCapabilities();
  const { modules } = useModules();
  const openSettings = useOpenSettings(isOwner);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [archived, setArchived] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [recent, setRecent] = useState<SearchRecentResponse | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const actions = useRef(new Map<string, () => void>());
  const latest = useRef(0);
  // The row being opened: search stays open with a spinner on it until the next page has rendered.
  const [opening, setOpening] = useState<string | null>(null);
  const [navigating, startNavigation] = useTransition();

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

  // The page it went to has rendered: close.
  useEffect(() => {
    if (opening && !navigating) {
      setOpening(null);
      onOpenChange(false);
    }
  }, [opening, navigating, onOpenChange]);

  // A fresh palette each time it opens (US-OPS-49: back to All), with this person's recent records.
  useEffect(() => {
    if (!open) {
      setOpening(null);
      setQuery("");
      setScope("all");
      setResult(null);
      return;
    }
    setArchived(readArchived());
    apiClient
      .get<SearchRecentResponse>("/search/recent")
      .then(setRecent)
      .catch(() => setRecent({ items: [], searches: [] }));
    // US-TAX-12: the GST settings pane is India's.
    if (isOwner && country === null) {
      apiClient
        .get<TaxProfile>("/org/tax/profile")
        .then((p) => setCountry(p.country ?? "other"))
        .catch(() => setCountry("other"));
    }
  }, [open, isOwner, country]);

  // Areas (and groups) this person can search: those whose page is in their sidebar.
  const pages = useMemo(() => new Set(sections.flatMap((s) => s.items.map((i) => i.href))), [sections]);
  const searchable = (type: SearchGroupType) => pages.has(SEARCH_GROUP_PAGE[type]);
  const scopes = (Object.keys(SEARCH_SCOPES) as SearchScope[]).filter((s) => SEARCH_SCOPES[s].some((type) => searchable(type)));
  const archivable = searchable("contacts") || searchable("catalog_items");
  const q = query.trim();

  useEffect(() => {
    if (q.length < SEARCH_MIN_LENGTH) {
      setResult(null);
      setLoading(false);
      return;
    }
    const request = ++latest.current;
    setLoading(true);
    const params = new URLSearchParams({ q, limit: String(scope === "all" ? SEARCH_LIMIT : SEARCH_SCOPED_LIMIT) });
    if (scope !== "all") params.set("types", SEARCH_SCOPES[scope].join(","));
    if (archived && archivable) params.set("includeArchived", "true");
    const timer = setTimeout(() => {
      apiClient
        .get<SearchResponse>(`/search?${params.toString()}`)
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
  }, [q, scope, archived, archivable]);

  /** Opens `href`, keeping search open with a spinner on the row until that page has rendered. */
  const navigate = (id: string, to: () => void) => {
    setOpening(id);
    startNavigation(to);
  };
  const go = (id: string, href: string) => {
    if (href === `${window.location.pathname}${window.location.search}`) {
      onOpenChange(false);
      return;
    }
    navigate(id, () => router.push(href));
  };
  /** A result was opened from this search: remember the search (US-OPS-39). */
  const remember = () => {
    apiClient.post("/search/recent", { query: q }).catch(() => {});
  };

  const handlers = new Map<string, () => void>();
  const groups: CommandPaletteGroup[] = [];

  if (q.length < SEARCH_MIN_LENGTH) {
    // US-OPS-39: recent records (in the chosen area) and searches.
    const items = (recent?.items ?? []).filter((r) => scope === "all" || SEARCH_GROUP_SCOPE[r.type] === scope);
    const searches = recent?.searches ?? [];
    if (items.length) {
      groups.push({
        heading: t("common.search.headings.recent"),
        items: items.map((r) => {
          const id = `recent:${r.type}:${r.id}`;
          handlers.set(id, () => go(id, r.href));
          return resultItem(r, id);
        }),
      });
    }
    if (searches.length) {
      groups.push({
        heading: t("common.search.headings.recentSearches"),
        items: searches.map((s, i) => {
          const id = `recent-search:${i}`;
          handlers.set(id, () => setQuery(s));
          return { id, title: s, icon: <History />, variant: "link" as const };
        }),
      });
    }
    if (items.length || searches.length) {
      // D-238: their own history, not business data — cleared without asking.
      handlers.set("clear-recent", () => {
        setRecent({ items: [], searches: [] });
        apiClient.delete("/search/recent").catch(() => {});
      });
      groups[groups.length - 1]!.items.push({ id: "clear-recent", title: t("common.search.clearRecent"), icon: <X />, variant: "link" });
    }
  } else {
    const local: CommandPaletteGroup[] = [];
    if (scope === "all") {
      // US-OPS-42: actions this person can take.
      const can = (c: (typeof SEARCH_ACTIONS)[number]) => {
        const path = c.href.split("?")[0]!;
        const page = path.replace(/\/new$/, "");
        return capabilities?.[c.capability] === true && pages.has(page) && pageAccessFor(path, role, capabilities).state === "allowed";
      };
      const acts = SEARCH_ACTIONS.filter((a) => can(a) && actionMatches(a, q)).slice(0, LOCAL_MAX);
      if (acts.length) {
        local.push({
          heading: t("common.search.headings.actions"),
          items: acts.map((a) => {
            const id = `action:${a.key}`;
            handlers.set(id, () => go(id, a.href));
            return { id, title: a.label, subtitle: a.area, icon: <Plus /> };
          }),
        });
      }
      // US-OPS-41: pages in this person's sidebar, and the reports they can open.
      const sidebarPages = sections.flatMap((s) =>
        s.items.map((i) => ({ href: i.href, title: i.label, area: s.label, icon: i.icon, keywords: PAGE_KEYWORDS[i.href] ?? "" })),
      );
      const reportPages = REPORTS.filter(
        (r) => r.href.startsWith("/reports/") && canOpenReport(r, role, capabilities) && (!r.country || r.country === country) && !ownedByOffModule(modules, "reports", r.slug),
      ).map((r) => ({ href: r.href, title: r.label, area: t("common.search.reportArea", { group: r.group }), icon: <BarChart3 />, keywords: r.keywords ?? "" }));
      const found = [...sidebarPages, ...reportPages]
        .filter((p) => matchesWordStarts(`${p.title} ${p.keywords}`, q))
        .slice(0, LOCAL_MAX);
      if (found.length) {
        local.push({
          heading: t("common.search.headings.pages"),
          items: found.map((p) => {
            const id = `page:${p.href}`;
            handlers.set(id, () => go(id, p.href));
            const why = matchesWordStarts(p.title, q) ? null : p.keywords;
            return { id, title: p.title, subtitle: why ? `${p.area} · ${why}` : p.area, icon: p.icon };
          }),
        });
      }
      // US-OPS-41: Settings panes, matched as Settings' own search does (US-SET-34).
      const panes = SETTINGS_SECTIONS.filter(
        (s) => (s.group === "account" || isOwner) && (!s.country || s.country === country) && !ownedByOffModule(modules, "settingsPanes", s.key) && !(s.href && pages.has(s.href)),
      );
      const settings = searchSettings(panes, q).slice(0, LOCAL_MAX);
      if (settings.length) {
        local.push({
          heading: t("common.search.headings.settings"),
          items: settings.map(({ section, matches }) => {
            const id = `settings:${section.key}`;
            const Icon = section.icon;
            handlers.set(id, () => (section.href ? go(id, section.href) : navigate(id, () => openSettings(section.key))));
            const group = SETTINGS_GROUPS.find((g) => g.key === section.group)?.label ?? t("common.search.headings.settings");
            return { id, title: section.label, subtitle: matches.length ? `${group} · ${matches.join(", ")}` : group, icon: <Icon /> };
          }),
        });
      }
    }

    const records: CommandPaletteGroup[] = (result?.groups ?? []).map((g) => {
      const items = g.items.map((r) => {
        const id = `result:${g.type}:${r.id}`;
        handlers.set(id, () => {
          remember();
          go(id, r.href);
        });
        return resultItem(r, id);
      });
      // US-OPS-40: the rest, in the section's list.
      const list = SEARCH_GROUP_LIST_HREF[g.type];
      if (list) {
        const id = `all:${g.type}`;
        handlers.set(id, () => {
          remember();
          go(id, `${list}?q=${encodeURIComponent(q)}`);
        });
        items.push({ id, title: t("common.search.seeAll", { noun: SEARCH_GROUP_NOUNS[g.type], query: q }), icon: <ArrowRight />, variant: "link" as const } as CommandPaletteItem);
      }
      return { heading: g.label, items };
    });
    // A document number's group stays first (US-OPS-22); otherwise actions, pages and settings lead.
    groups.push(...(parseDocumentNumber(q) ? [...records, ...local] : [...local, ...records]));
  }
  actions.current = handlers;

  const areas = (Object.keys(SEARCH_GROUP_PAGE) as SearchGroupType[]).filter(searchable).map((type) => (type === "catalog_items" ? t("common.search.theCatalogue") : SEARCH_GROUP_NOUNS[type]));
  const hint = (
    <span className="flex flex-col gap-1.5">
      <span className="font-medium text-on-surface">{t("common.search.hint")}</span>
      {areas.length > 0 && <span>{field ? t("common.search.canSearchYour", { areas: listOf(areas) }) : t("common.search.canSearch", { areas: listOf(areas) })}</span>}
    </span>
  );
  const empty = (
    <span className="flex flex-col gap-1.5">
      <span className="font-medium text-on-surface">{t("common.search.noResults", { query: q })}</span>
      <span>
        {t("common.search.noResultsHint")}
        {archivable && !archived ? t("common.search.noResultsArchived") : ""}
      </span>
    </span>
  );

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      label={t("common.search.label")}
      query={query}
      onQueryChange={setQuery}
      placeholder={t("common.search.placeholder")}
      groups={groups}
      loading={loading}
      highlight={q.length >= SEARCH_MIN_LENGTH ? q : undefined}
      hint={q.length < SEARCH_MIN_LENGTH && recent ? hint : undefined}
      emptyMessage={result && q.length >= SEARCH_MIN_LENGTH ? empty : undefined}
      onSelect={(item) => {
        // One at a time: a second pick while a page is opening is ignored.
        if (!opening) actions.current.get(item.id)?.();
      }}
      pendingId={opening}
      toolbar={
        scopes.length > 1 ? (
          <ToggleGroup
            type="single"
            aria-label={t("common.search.searchIn")}
            value={scope}
            onValueChange={(v) => v && setScope(v as Scope)}
            className="max-w-full overflow-x-auto"
          >
            <ToggleGroupItem value="all" size="sm" tooltip={false}>
              {t("common.search.all")}
            </ToggleGroupItem>
            {scopes.map((s) => (
              <ToggleGroupItem key={s} value={s} size="sm" tooltip={false}>
                {SEARCH_SCOPE_LABELS[s]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : undefined
      }
      footer={
        <>
          <span>{t("common.search.footerMove")}</span>
          <span>{t("common.search.footerOpen")}</span>
          <span>{t("common.search.footerClose")}</span>
          {archivable && (
            <label className="ml-auto flex cursor-pointer items-center gap-2 font-medium text-on-surface">
              <Checkbox
                checked={archived}
                onCheckedChange={(v) => {
                  const next = v === true;
                  setArchived(next);
                  try {
                    window.localStorage.setItem(ARCHIVED_KEY, next ? "1" : "0");
                  } catch {
                    // A per-device convenience; without storage it's just not remembered.
                  }
                }}
              />
              {t("common.search.includeArchived")}
            </label>
          )}
        </>
      }
    />
  );
}

/**
 * US-OPS-48 — search in the sidebar: a field-like button reading "Search…"
 * with its shortcut, or the icon alone (with a tooltip) when the sidebar is
 * collapsed.
 */
export function SearchButton({ onClick, collapsed = false }: { onClick: () => void; collapsed?: boolean }) {
  const t = useT();
  const [mac, setMac] = useState(true);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  const shortcut = mac ? "⌘K" : "Ctrl K";
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={t("common.search.label")}
        title={t("common.search.buttonTitle", { shortcut })}
        aria-keyshortcuts="Meta+K Control+K"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Search size={16} aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("common.search.label")}
      aria-keyshortcuts="Meta+K Control+K"
      className="flex h-8.5 w-full items-center gap-2 rounded-md border border-border bg-background pl-2.5 pr-2 text-[13px] text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <Search size={15} aria-hidden />
      <span className="flex-1 text-left">{t("common.search.button")}</span>
      {/* US-OPS-61: a touch screen has no keyboard shortcut to show. */}
      <kbd className="rounded-sm border border-border bg-surface px-1.5 text-[11px] font-medium text-on-surface-muted [@media(pointer:coarse)]:hidden" data-testid="search-shortcut">{shortcut}</kbd>
    </button>
  );
}
