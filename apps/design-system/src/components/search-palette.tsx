"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { flatNavItems } from "@/lib/nav";

export function SearchPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-start justify-center bg-black/30 pt-[15vh]"
      onClick={() => onOpenChange(false)}
    >
      <Command
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-[0_10px_30px_rgba(33,31,26,0.14)]"
        onClick={(event) => event.stopPropagation()}
        shouldFilter
      >
        <Command.Input
          autoFocus
          placeholder="Search components, tokens, pages…"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-[14px] text-on-surface placeholder:text-on-surface-muted focus:outline-none"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-2 py-6 text-center text-[13px] text-on-surface-muted">
            No results found.
          </Command.Empty>
          {flatNavItems().map((item) => (
            <Command.Item
              key={item.href}
              value={`${item.section} ${item.title}`}
              onSelect={() => {
                router.push(item.href);
                onOpenChange(false);
              }}
              className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-[13px] text-on-surface data-[selected=true]:bg-surface-sunken"
            >
              <span>{item.title}</span>
              <span className="text-[12px] text-on-surface-muted">{item.section}</span>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
