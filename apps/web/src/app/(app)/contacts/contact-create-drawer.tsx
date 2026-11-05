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
import { useRouter } from "next/navigation";
import { ContactForm } from "./contact-form";
import type { Contact } from "./types";
import { useT } from "../../../lib/i18n";

/**
 * Phase 2's Add-Contact flow: a Drawer opened from the list page's primary
 * action, composing the existing `ContactForm` unchanged in its create
 * logic — only how it's hosted changes (drawer, not a full-page
 * navigation). See the list page's own comment for the drawer-vs-route
 * reasoning (kept a route too, `/contacts/new`, for shareability — this
 * component is what both that route and the list page's drawer render).
 */
export function ContactCreateDrawer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (contact: Contact) => void;
}) {
  const t = useT();
  const router = useRouter();
  const formId = useId();
  const [saving, setSaving] = useState(false);

  function handleSuccess(contact: Contact) {
    onOpenChange(false);
    onCreated(contact);
    // Prefetch the detail route so a follow-up click into the new contact
    // (from the refreshed list) feels instant — not a navigation itself.
    router.prefetch(`/contacts/${contact.id}`);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t("contacts.createDrawer.title")}</DrawerTitle>
          <DrawerDescription>
            {t("contacts.createDrawer.description")}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <ContactForm formId={formId} onSubmittingChange={setSaving} onSuccess={handleSuccess} />
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("contacts.common.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? <Spinner size="sm" /> : t("contacts.createDrawer.save")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
