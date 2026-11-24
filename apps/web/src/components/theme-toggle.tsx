"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useT } from "../lib/i18n";

/** `inline` sits in a page's own top bar (AuthFrame, D-207); `floating` stays bottom-right. */
export function ThemeToggle({ placement = "floating" }: { placement?: "floating" | "inline" } = {}) {
  const t = useT();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      aria-label={t("common.themeToggle.label")}
      className={
        placement === "inline"
          ? "flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          : "fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-on-surface-muted shadow-lg transition-colors hover:bg-surface-sunken hover:text-on-surface"
      }
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted && resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
