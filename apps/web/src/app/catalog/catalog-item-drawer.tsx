"use client";

import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Spinner,
} from "@spine/ui";
import { useId, useState } from "react";
import { CatalogForm } from "./catalog-form";
import type { CatalogItem } from "./types";

/**
 * Create-or-edit Drawer for a catalog item, following ContactCreateDrawer's
 * exact composition (form lives outside the footer, footer's Save button
 * submits it via `form={formId}`). One component handles both create and
 * edit — pass `item` to edit, omit it to create — since a catalog item's
 * form has no create-only fields the way ContactForm's logo-upload timing
 * did, so there was no need to split into two components.
 */
export function CatalogItemDrawer({
  open,
  onOpenChange,
  item,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: CatalogItem;
  onSaved: (item: CatalogItem, mode: "created" | "updated") => void;
}) {
  const formId = useId();
  const [saving, setSaving] = useState(false);

  function handleSuccess(saved: CatalogItem) {
    setSaving(false);
    onOpenChange(false);
    onSaved(saved, item ? "updated" : "created");
  }

  // The Drawer's content stays mounted across close/reopen (this component
  // handles both create and edit in one long-lived instance, unlike
  // ContactCreateDrawer's create-only, remount-per-open shape), so `saving`
  // must be reset explicitly on close — otherwise a prior submit's `true`
  // (set right before handleSuccess/onOpenChange(false) fire) leaks into
  // the next open as a stuck spinner with no label.
  function handleOpenChange(next: boolean) {
    if (!next) setSaving(false);
    onOpenChange(next);
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{item ? "Edit item" : "Add item"}</DrawerTitle>
          <DrawerDescription>
            {item
              ? "Update this item's default price, tax rate or account mapping."
              : "Goods or services with a default price and tax rate — you can override the price on a quote later."}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <CatalogForm formId={formId} item={item} onSubmittingChange={setSaving} onSuccess={handleSuccess} />
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? <Spinner size="sm" /> : "Save item"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
