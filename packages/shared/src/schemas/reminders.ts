import { z } from "zod";

/**
 * US-INV-18 / US-INV-19 (D-091) — the `invoice_reminders` setting. Offsets
 * are days relative to the due date (negative = before). After the last
 * offset a reminder can repeat every `repeatEvery` days, `repeatMax` times.
 */
export const REMINDER_OFFSET_OPTIONS = [
  { offset: -3, label: "3 days before the due date" },
  { offset: 0, label: "On the due date" },
  { offset: 7, label: "7 days after the due date" },
  { offset: 14, label: "14 days after the due date" },
] as const;
export const REMINDER_REPEAT = { every: 14, max: 3, label: "Every 14 days after that, up to 3 more times" } as const;
export const PICK_A_REMINDER = "Pick at least one reminder.";

export const invoiceRemindersSchema = z
  .object({
    enabled: z.boolean(),
    offsets: z.array(z.number().int().min(-30).max(90)).max(10),
    repeatEvery: z.number().int().min(1).max(60).nullable().optional(),
    repeatMax: z.number().int().min(1).max(12).nullable().optional(),
    sendAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time to send at."),
  })
  .superRefine((v, ctx) => {
    if (v.enabled && v.offsets.length === 0) ctx.addIssue({ code: "custom", message: PICK_A_REMINDER, path: ["offsets"] });
  });

export type InvoiceReminders = z.infer<typeof invoiceRemindersSchema>;

/** D-091: off, with the due date, +7 and +14 days ticked, at 9:00 AM. */
export const DEFAULT_INVOICE_REMINDERS: InvoiceReminders = { enabled: false, offsets: [0, 7, 14], repeatEvery: null, repeatMax: null, sendAt: "09:00" };

/** Every day (relative to the due date) a reminder is due under these settings, ascending. */
export function reminderDays(settings: Pick<InvoiceReminders, "offsets" | "repeatEvery" | "repeatMax">): number[] {
  const days = new Set(settings.offsets);
  if (settings.repeatEvery && settings.repeatMax && settings.offsets.length) {
    const last = Math.max(...settings.offsets);
    for (let k = 1; k <= settings.repeatMax; k++) days.add(last + k * settings.repeatEvery);
  }
  return [...days].sort((a, b) => a - b);
}
