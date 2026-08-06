"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox } from "@spine/ui";
import { apiClient } from "../../lib/api-client";

const CHECKLIST_ITEMS = [
  { key: "first_customer", label: "Add your first customer" },
  { key: "first_item", label: "Create your first item" },
  { key: "first_quote", label: "Send your first quote" },
];

/**
 * Persistent, dismissible setup checklist (S-12.9 / PRD F12). Judgment
 * call, documented per task brief: contacts/catalog/quotes have no
 * schema/UI yet anywhere in the codebase (checked apps/api/src/modules —
 * empty stubs), so there is nothing real to check completion against.
 * This renders the three example items as static, always-unchecked
 * placeholders — NOT wired to detect real completion, which is explicitly
 * deferred to whenever those modules exist. Only the dismiss action is
 * real, persisted as the `dashboard_checklist_dismissed` org setting so it
 * survives a reload/relogin. Once contacts/catalog/quotes land, replace
 * the static `false` completion states here with real queries and this
 * component doesn't need to change shape, only its data source.
 */
export function SetupChecklist() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ key: string; value: { dismissed: boolean } | null }>("/org/settings/dashboard_checklist_dismissed")
      .then((res) => {
        if (!cancelled) setDismissed(res.value?.dismissed ?? false);
      })
      .catch(() => {
        if (!cancelled) setDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDismiss() {
    setDismissed(true);
    await apiClient.put("/org/settings/dashboard_checklist_dismissed", { value: { dismissed: true } });
  }

  if (dismissed !== false) {
    return null;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Get started</CardTitle>
        <CardDescription>A few things to do before your first real transaction.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {CHECKLIST_ITEMS.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-[13px] text-on-surface">
              <Checkbox checked={false} disabled />
              {item.label}
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" className="self-start" onClick={handleDismiss}>
          Dismiss
        </Button>
      </CardContent>
    </Card>
  );
}
