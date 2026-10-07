import { z } from "zod";

export const currencyCodeSchema = z.string().length(3);

export const moneySchema = z.object({
  amount: z.coerce.bigint(),
  currency: currencyCodeSchema,
});

export const uuidSchema = z.string().uuid();

export const orgScopedSchema = z.object({
  id: uuidSchema,
  orgId: uuidSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: uuidSchema,
});

/** US-TAX-13 — a GST state code ("29") or "96" for other countries. */
export const placeOfSupplySchema = z.string().regex(/^\d{2}$/, "Choose a place of supply from the list.");
