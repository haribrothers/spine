"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
} from "@spine/ui";
import { ChevronDown, Laptop, ListChecks, LogOut, Moon, Settings, Sun, UserCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { authClient } from "../lib/auth-client";
import { SettingsDialog } from "./settings-dialog";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

/**
 * The AppShellSidebar footer's user menu: avatar + name + a chevron (no
 * email on the trigger — email only appears in the dropdown's identity
 * header), collapsing to just the avatar when the sidebar is an icon rail.
 * Opens a dropdown with an avatar/name/email identity block, Settings, a
 * three-way theme switcher, and sign-out. Theme control lives here since
 * the shell has real persistent chrome to put it in — /login and /signup
 * keep their own floating ThemeToggle since they render outside this shell.
 */
export function AppUserMenu({
  name,
  email,
  collapsed,
  isOwner,
}: {
  name: string;
  email: string;
  collapsed: boolean;
  /** CLAUDE.md — org Settings is Owner-only. Hides the "Settings" item entirely for Staff/Field, same UI-nicety-not-security-boundary framing as the Team nav section (the API independently rejects any non-Owner PUT regardless). */
  isOwner: boolean;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // US-SET-15: `?settings=<pane>` anywhere in the app opens Settings on that pane (the data-export email links here).
  const [settingsPane, setSettingsPane] = useState<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const pane = url.searchParams.get("settings");
    if (!pane) return;
    setSettingsPane(pane);
    setSettingsOpen(true);
    url.searchParams.delete("settings");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
                ? "flex h-9 w-9 items-center justify-center rounded-sm transition-colors hover:bg-surface-sunken"
                : "flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left transition-colors hover:bg-surface-sunken"
            }
          >
            <Avatar size="sm">
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-on-surface">{name}</span>
                <ChevronDown size={14} className="shrink-0 text-on-surface-muted" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-60">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar size="sm">
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-on-surface">{name}</span>
              <span className="block truncate text-[12px] text-on-surface-muted">{email}</span>
            </span>
          </div>
          <DropdownMenuSeparator />
          {/*
            Settings opens the SettingsDialog with state owned by this
            component rather than a nested DialogTrigger — Radix's
            DropdownMenu unmounts its items (tearing down any DialogTrigger
            inside one) as soon as onSelect fires, which would tear the
            Dialog down before it ever opens. Flipping external state from
            onSelect avoids that pitfall entirely.
          */}
          {/*
            Profile & Preferences is a real route, not a dialog (PRD
            S-10.17 — every role, unlike Settings which is Owner-only) — a
            plain router.push is safe here, unlike Settings' onSelect above,
            since navigation doesn't need the deferred-unmount workaround a
            nested DialogTrigger would.
          */}
          <DropdownMenuItem onSelect={() => router.push("/profile")}>
            <UserCircle size={14} className="mr-2" />
            Profile &amp; Preferences
          </DropdownMenuItem>
          {isOwner && (
            <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
              <Settings size={14} className="mr-2" />
              Settings
            </DropdownMenuItem>
          )}
          {/* US-ONB-15 — Owners only, like Settings. */}
          {isOwner && (
            <DropdownMenuItem onSelect={() => router.push("/setup")}>
              <ListChecks size={14} className="mr-2" />
              Set up Spine
            </DropdownMenuItem>
          )}
          <div className="px-2 py-1.5">
            <ToggleGroup
              type="single"
              value={mounted ? theme : undefined}
              onValueChange={(value) => value && setTheme(value)}
              className="w-full rounded-sm bg-surface-sunken p-0.5"
            >
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <ToggleGroupItem key={value} value={value} aria-label={label} className="h-7 flex-1 px-0">
                  <Icon size={14} />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive disabled={signingOut} onSelect={handleSignOut}>
            {signingOut ? <Spinner size="sm" className="mr-2" /> : <LogOut size={14} className="mr-2" />}
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} isOwner={isOwner} initialKey={settingsPane} />
    </>
  );
}
