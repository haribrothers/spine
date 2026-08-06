"use client";

import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@spine/ui";
import { useRouter } from "next/navigation";
import { ContactForm } from "./contact-form";
import type { Contact } from "./types";

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
  const router = useRouter();

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
          <DrawerTitle>Add contact</DrawerTitle>
          <DrawerDescription>
            Name, type and how to reach them — you can add contact persons and addresses after saving.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <ContactForm onSuccess={handleSuccess} />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
