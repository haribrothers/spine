"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
} from "@spine/ui";
import { ChevronDown, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { apiClient } from "../lib/api-client";
import { authClient } from "../lib/auth-client";
import { useAccount, type Account } from "../lib/account-context";
import { initials } from "../lib/initials";
import { MENU_ICONS } from "../lib/menu-icons";
import { useOpenSettings } from "./settings-route";
import { useToast } from "./toast-host";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop, aria: "Follow system" },
] as const;

/** The tab's "already applied the saved theme" mark (account-context), cleared on sign-out. */
const THEME_APPLIED_KEY = "spine.theme.applied";

/**
 * The AppShellSidebar footer's user menu: photo (or initials) + name + a
 * chevron, collapsing to the photo alone when the sidebar is an icon rail.
 * Opens with the identity block, Settings (every role, US-SET-30), Set up
 * Spine (Owners), the theme switch — saved to the account so it follows
 * the person to every device (US-AUTH-16) — and Sign out.
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
  /** Set up Spine is Owner-only (US-ONB-15); Settings shows Owners the business's groups too (US-SET-30). */
  isOwner: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const openSettings = useOpenSettings(isOwner);
  const { account, setAccount } = useAccount();
  const { theme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const shownName = account?.name ?? name;
  const shownEmail = account?.email ?? email;
  const image = account?.image ?? null;

  async function chooseTheme(value: string) {
    setTheme(value);
    try {
      setAccount(await apiClient.put<Account>("/users/me/preferences", { themePreference: value }));
    } catch {
      toast("Couldn't save your theme.", "It's used on this device until you sign in again.");
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      window.sessionStorage.removeItem(THEME_APPLIED_KEY);
    } catch {
      // Nothing stored.
    }
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  const avatar = (
    <Avatar size="sm">
      {image && <AvatarImage src={image} alt="" />}
      <AvatarFallback>{initials(shownName)}</AvatarFallback>
    </Avatar>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Your account: ${shownName}`}
          className={
            collapsed
              ? "flex h-9 w-9 items-center justify-center rounded-sm transition-colors hover:bg-surface-sunken"
              : "flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left transition-colors hover:bg-surface-sunken"
          }
        >
          {avatar}
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-on-surface">{shownName}</span>
              <ChevronDown size={14} className="shrink-0 text-on-surface-muted" aria-hidden />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-64">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar size="md">
            {image && <AvatarImage src={image} alt="" />}
            <AvatarFallback>{initials(shownName)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-on-surface">{shownName}</span>
            <span className="block truncate text-[12px] text-on-surface-muted">{shownEmail}</span>
          </span>
        </div>
        <DropdownMenuSeparator />
        {/* US-SET-30: every role has Settings; it opens on their first pane. */}
        <DropdownMenuItem onSelect={() => openSettings()}>
          <MENU_ICONS.settings aria-hidden />
          Settings
        </DropdownMenuItem>
        {/* US-ONB-15 — Owners only. */}
        {isOwner && (
          <DropdownMenuItem onSelect={() => router.push("/setup")}>
            <MENU_ICONS.setUp aria-hidden />
            Set up Spine
          </DropdownMenuItem>
        )}
        {/* US-AUTH-16: menu radio items (a menu can't hold a radiogroup), shown as a three-way switch. */}
        <DropdownMenuRadioGroup
          value={mounted ? theme : undefined}
          onValueChange={(value) => void chooseTheme(value)}
          aria-label="Theme"
          className="mx-1.5 my-1 flex gap-0.5 rounded-sm bg-surface-sunken p-0.5"
          data-testid="theme-switch"
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const name = "aria" in option ? option.aria : option.label;
            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                aria-label={name}
                title={name}
                onSelect={(e) => e.preventDefault()}
                className="min-h-7 flex-1 justify-center gap-1 rounded-sm px-1 py-1 text-[12px] text-on-surface data-[state=checked]:bg-surface data-[state=checked]:shadow-raised [&>span:first-child]:hidden"
              >
                <Icon size={13} aria-hidden />
                {option.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive disabled={signingOut} onSelect={handleSignOut}>
          {signingOut ? <Spinner size="sm" /> : <MENU_ICONS.signOut aria-hidden />}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
