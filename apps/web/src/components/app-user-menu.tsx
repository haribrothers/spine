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
} from "@spine/ui";
import { ChevronDown, Laptop, LogOut, Moon, Settings, Sun } from "lucide-react";
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
export function AppUserMenu({ name, email, collapsed }: { name: string; email: string; collapsed: boolean }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
            <Settings size={14} className="mr-2" />
            Settings
          </DropdownMenuItem>
          <div className="flex items-center gap-1 px-2 py-1.5">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = mounted && theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTheme(value)}
                  className={
                    active
                      ? "flex flex-1 flex-col items-center gap-1 rounded-sm bg-surface-sunken px-2 py-1.5 text-primary"
                      : "flex flex-1 flex-col items-center gap-1 rounded-sm px-2 py-1.5 text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
                  }
                >
                  <Icon size={14} />
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              );
            })}
          </div>
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
