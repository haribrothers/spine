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
