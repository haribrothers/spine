"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FormField,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
} from "@spine/ui";
import { DEFAULT_INVOICE_REMINDERS, PICK_A_REMINDER, REMINDER_OFFSET_OPTIONS, REMINDER_REPEAT, type InvoiceReminders } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useSettingsValue } from "../use-settings-value";
import { SavedToast } from "../saved-toast";
import { t, useT } from "../../../lib/i18n";

/** Half-hour steps from 6:00 AM to 8:00 PM. */
const SEND_AT_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  const h12 = Math.floor(minutes / 60) % 12 || 12;
  return { value: `${hh}:${mm}`, label: t("settings.reminders.sendAtOption", { time: `${h12}:${mm} ${minutes < 720 ? "AM" : "PM"}` }) };
});

/**
 * US-INV-18 (D-091) — Settings › Automatic reminders: whether Spine emails
 * customers about unpaid invoices, on which days around the due date, and
 * at what time. Stored as the `invoice_reminders` setting; the daily run
 * is US-INV-19.
 */
export function RemindersPane() {
  const t = useT();
  const { value, ready } = useSettingsValue<InvoiceReminders>("invoice_reminders", DEFAULT_INVOICE_REMINDERS);
  const [form, setForm] = useState<InvoiceReminders>(DEFAULT_INVOICE_REMINDERS);
  const [problem, setProblem] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string; sample: boolean } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (ready) setForm({ ...DEFAULT_INVOICE_REMINDERS, ...value });
  }, [ready, value]);

  const repeatOn = !!form.repeatEvery && !!form.repeatMax;

  function toggleOffset(offset: number, on: boolean) {
    setProblem(undefined);
    setForm((f) => ({ ...f, offsets: on ? [...f.offsets, offset].sort((a, b) => a - b) : f.offsets.filter((o) => o !== offset) }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.enabled && form.offsets.length === 0) {
      setProblem(PICK_A_REMINDER);
      return;
    }
    setSaving(true);
    try {
      await apiClient.put("/org/settings/invoice_reminders", { value: form });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.reminders.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function openPreview() {
    setPreviewing(true);
    try {
      setPreview(await apiClient.get("/invoice-reminders/preview"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.reminders.previewError"));
    } finally {
      setPreviewing(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSave} noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">{t("settings.reminders.title")}</h2>
        <p className="text-[13px] text-on-surface-muted">{t("settings.reminders.description")}</p>
      </div>
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
        <Switch id="reminders-enabled" checked={form.enabled} onCheckedChange={(enabled) => (setProblem(undefined), setForm((f) => ({ ...f, enabled })))} />
        <div className="flex flex-col">
          <Label htmlFor="reminders-enabled" className="text-[14px] font-semibold text-on-surface">
            {t("settings.reminders.enabled")}
          </Label>
          <span className="text-[13px] text-on-surface-muted">{t("settings.reminders.enabledHelp")}</span>
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-[13px] font-semibold text-on-surface">{t("settings.reminders.schedule")}</legend>
        {REMINDER_OFFSET_OPTIONS.map((option) => (
          <label key={option.offset} className="flex items-center gap-3 text-[14px] text-on-surface">
            <Checkbox checked={form.offsets.includes(option.offset)} onCheckedChange={(v) => toggleOffset(option.offset, v === true)} />
            {option.label}
          </label>
        ))}
        <label className="flex items-center gap-3 text-[14px] text-on-surface">
          <Checkbox
            checked={repeatOn}
            onCheckedChange={(v) => setForm((f) => ({ ...f, repeatEvery: v === true ? REMINDER_REPEAT.every : null, repeatMax: v === true ? REMINDER_REPEAT.max : null }))}
          />
          {REMINDER_REPEAT.label}
        </label>
        {problem && <p className="text-[13px] text-overdue">{problem}</p>}
      </fieldset>

      <FormField label={t("settings.reminders.sendAt")} className="max-w-xs">
        {(field) => (
          <Select value={form.sendAt} onValueChange={(sendAt) => setForm((f) => ({ ...f, sendAt }))}>
            <SelectTrigger {...field} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEND_AT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      <p className="text-[13px] text-on-surface-muted">
        {t("settings.reminders.note")}
      </p>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner size="sm" /> : t("settings.common.save")}
        </Button>
        <Button type="button" variant="secondary" onClick={openPreview} disabled={previewing}>
          {previewing ? <Spinner size="sm" /> : t("settings.reminders.previewButton")}
        </Button>
      </div>
      <SavedToast open={saved} onOpenChange={setSaved} />

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("settings.reminders.previewTitle")}</DialogTitle>
            <DialogDescription>
              {preview?.sample ? t("settings.reminders.previewSample") : t("settings.reminders.previewOverdue")}{t("settings.reminders.previewSubject", { subject: preview?.subject ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {preview && <iframe title={t("settings.reminders.previewTitle")} sandbox="" srcDoc={preview.html} className="h-[520px] w-full rounded-md border border-border" />}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </form>
  );
}
