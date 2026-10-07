import { eq } from "drizzle-orm";
import type { Database, Transaction } from "../db/client";
import { contacts } from "../db/schema";

/**
 * US-ONB-17 (D-191) — whether a contact is demo data. A document saved for
 * one is demo too (the database sets `is_demo` as the row is written); this
 * is for code that needs the answer earlier, such as the number series a
 * payment takes before its row exists.
 */
export async function contactIsDemo(db: Database | Transaction, contactId: string | null | undefined): Promise<boolean> {
  if (!contactId) return false;
  const [row] = await db.select({ isDemo: contacts.isDemo }).from(contacts).where(eq(contacts.id, contactId));
  return row?.isDemo ?? false;
}
