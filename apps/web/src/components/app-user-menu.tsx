"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
} from "@spine/ui";
import { LogOut, Moon, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { authClient } from "../lib/auth-client";
import { SettingsDialog } from "./settings-dialog";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * The AppShellSidebar footer's user menu: avatar + name (hidden when the
 * sidebar is collapsed to an icon rail — the trigger stays just the
 * avatar), opening a dropdown with the theme toggle and sign-out. Theme
 * control moves in here now that the shell has real persistent chrome to
 * put it in (per task brief) — /login and /signup keep their own floating
 * ThemeToggle since they render outside this shell.
 */
export function AppUserMenu({ name, email, collapsed }: { name: string; email: string; collapsed: boolean }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={
              collapsed
                ? "flex w-full items-center justify-center rounded-sm py-1 transition-colors hover:bg-surface-sunken"
                : "flex w-full items-center gap-2.5 rounded-sm px-1.5 py-1.5 text-left transition-colors hover:bg-surface-sunken"
            }
          >
            <Avatar size="sm">
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-on-surface">{name}</span>
                <span className="block truncate text-[12px] text-on-surface-muted">{email}</span>
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/*
            Settings opens the SettingsDialog with state owned by this
            component rather than a nested DialogTrigger — Radix's
            DropdownMenu unmounts its items (tearing down any DialogTrigger
            inside one) as soon as onSelect fires, which would tear the
            Dialog down before it ever opens. Flipping external state from
            onSelect avoids that pitfall entirely.
          */}
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
            <Settings size={14} className="mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            {resolvedTheme === "dark" ? <Sun size={14} className="mr-2" /> : <Moon size={14} className="mr-2" />}
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive disabled={signingOut} onSelect={handleSignOut}>
            {signingOut ? <Spinner size="sm" className="mr-2" /> : <LogOut size={14} className="mr-2" />}
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
