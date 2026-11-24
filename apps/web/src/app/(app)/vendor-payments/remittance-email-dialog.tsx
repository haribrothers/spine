"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Spinner, Textarea } from "@spine/ui";
import { FileText, Send } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * US-PUR-54 (D-229) — "Email remittance advice": To (the vendor's address),
 * Subject and a message that names the bills, with the PDF attached. The
 * dialog is the check before sending (D-218); problems stay in it.
 */
export function RemittanceEmailDialog({
  open,
  onOpenChange,
  paymentId,
  number,
  vendorName,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  number: string;
  vendorName: string;
  onSent: (to: string) => void;
}) {
  const t = useT();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setTouched(false);
    setError(null);
    apiClient
      .get<{ to: string | null; subject: string; body: string }>(`/vendor-payments/${paymentId}/remittance/draft`)
      .then((d) => {
        setTo(d.to ?? "");
        setSubject(d.subject);
        setBody(d.body);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("vendorPayments.remittance.loadFailed")))
      .finally(() => setLoading(false));
  }, [open, paymentId]);

  const toError = !to.trim() ? t("vendorPayments.remittance.enterEmail") : EMAIL.test(to.trim()) ? undefined : t("vendorPayments.remittance.invalidEmail");

  async function send() {
    setTouched(true);
    if (toError || !subject.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await apiClient.post(`/vendor-payments/${paymentId}/remittance/send`, { to: to.trim(), subject: subject.trim(), body: body.trim() });
      onOpenChange(false);
      onSent(to.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vendorPayments.remittance.sendFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t("vendorPayments.remittance.title")}</DialogTitle>
          <DialogDescription>
            {t("vendorPayments.remittance.description", { vendor: vendorName, number })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              <FormField label={t("vendorPayments.remittance.to")} required errorText={touched ? toError : undefined}>
                {(field) => <Input {...field} type="email" value={to} onChange={(e) => setTo(e.target.value)} />}
              </FormField>
              <FormField label={t("vendorPayments.remittance.subject")} required errorText={touched && !subject.trim() ? t("vendorPayments.remittance.enterSubject") : undefined}>
                {(field) => <Input {...field} value={subject} onChange={(e) => setSubject(e.target.value)} />}
              </FormField>
              <FormField label={t("vendorPayments.remittance.message")} required errorText={touched && !body.trim() ? t("vendorPayments.remittance.writeMessage") : undefined}>
                {(field) => <Textarea {...field} value={body} rows={8} onChange={(e) => setBody(e.target.value)} />}
              </FormField>
              <span className="inline-flex items-center gap-2 self-start rounded-md border border-border bg-surface-sunken px-2.5 py-1.5 text-[12.5px] font-medium text-on-surface" data-testid="remittance-attachment">
                <FileText size={14} aria-hidden className="text-overdue" />
                {/* The attachment's file name, not copy. */}
                {`remittance-${number}.pdf`}
              </span>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={sending}>
            {t("vendorPayments.remittance.cancel")}
          </Button>
          <Button onClick={() => void send()} disabled={sending || loading}>
            {sending ? <Spinner size="sm" /> : <Send size={14} aria-hidden />}
            {t("vendorPayments.remittance.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
