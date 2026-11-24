"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { nav } from "@/lib/nav";
import { ThemeToggle } from "./theme-toggle";

export function TopBar({ onSearchOpen }: { onSearchOpen: () => void }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-[1100] flex h-14 items-center gap-6 border-b border-border bg-surface px-6">
      <Link href="/overview" className="text-[15px] font-semibold tracking-tight text-on-surface">
        Spine
      </Link>

      <nav className="flex flex-1 items-center gap-1">
        {nav.map((section) => {
          const isActive = pathname.startsWith(`/${section.slug}`);
          return (
            <Link
              key={section.slug}
              href={section.sections[0]?.items[0]?.href ?? "/"}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-surface-sunken text-primary"
                  : "text-on-surface-muted hover:text-on-surface"
              }`}
            >
              {section.title}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onSearchOpen}
        className="flex items-center gap-2 rounded-md border border-border bg-surface-sunken px-3 py-1.5 text-[13px] text-on-surface-muted transition-colors hover:border-border-strong"
      >
        <Search size={14} />
        <span>Search</span>
        <kbd className="ml-2 rounded border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-[11px]">
          ⌘K
        </kbd>
      </button>

      <ThemeToggle />
    </header>
  );
}
