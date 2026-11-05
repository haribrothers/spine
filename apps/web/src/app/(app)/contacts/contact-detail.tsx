"use client";

import { useModule } from "../../../lib/modules-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Checkbox,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@spine/ui";
import { ArrowLeft } from "lucide-react";
import { GST_TREATMENT_LABELS, gstStateLabel, gstinRequired, type GstTreatment } from "@spine/shared";
import { ContactGstFields, contactGstError, useTaxCountry } from "./contact-gst-fields";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import type { Activity, Contact, ContactType, Lead, SpineFile } from "./types";
import { AddressesSection } from "./addresses-section";
import { ContactLogo } from "./contact-logo";
import { ContactPersonsSection } from "./contact-persons-section";
import { LeadsSection } from "./leads-section";
import { ActivitiesSection } from "./activities-section";
import { HistorySection } from "../../../components/history-section";
import { TimelineSection } from "./timeline-section";
import { useToast } from "../../../components/toast-host";
import { StatementDialog } from "./statement-dialog";
import { CustomerRefundDialog, refundToast } from "../../../components/customer-refund-dialog";
import { loadCustomerCredit } from "../../../lib/customer-credit";
import { AttachmentsSection } from "../../../components/attachments-section";
import { useLoadFailure } from "../../../lib/use-load-failure";
import { t as translate, useT } from "../../../lib/i18n";

const TYPE_LABELS: Record<Contact["type"], string> = {
  customer: translate("contacts.common.typeCustomer"),
  vendor: translate("contacts.common.typeVendor"),
  both: translate("contacts.common.typeBoth"),
};

const TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: "customer", label: translate("contacts.common.typeCustomer") },
  { value: "vendor", label: translate("contacts.common.typeVendor") },
  { value: "both", label: translate("contacts.common.typeBoth") },
];

/**
 * S-01.3 is now live in the "Timeline" tab (timeline-section.tsx) — a
 * merged, chronological feed of quote lifecycle events and logged
 * activities (which already cover "note" per ActivityType). Invoices and
 * payments don't exist yet (Phase 2), so they're not in the feed yet
 * either — nothing here is a placeholder or fabricated event, only what's
 * real today, with the feed structured so invoice/payment events slot in
 * as their own source once those modules land.
 *
 * Phase 3 redesign (this session, replacing the two-column layout from the
 * immediately-prior session): a back button + header (logo/avatar, name,
 * badges, primary actions) at the top, then Tabs — "Contact persons",
 * "Addresses", "Leads", "Activities" — host the same section components as
 * before, unchanged in their own internal CRUD logic (edit/archive/delete
 * for the contact itself; add/remove for each tab's entity). No separate
 * "Overview" tab: the contact's own editable fields live in the header
 * (inline edit, same as before), so a redundant Overview tab hosting only
 * a repeat of those same fields was skipped per the task brief's own
 * "or skip a redundant Overview tab — your call" allowance.
 */
export function ContactDetail({ contactId }: { contactId: string }) {
  const t = useT();
  const loadFailed = useLoadFailure(contactId);
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  // US-SET-24: no leads while Leads & meetings is switched off.
  const leadsOn = useModule("leadsMeetings");
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<ContactType>("customer");
  const [isCompany, setIsCompany] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  // US-TAX-12 — GST treatment and GSTIN for an Indian business.
  const taxCountry = useTaxCountry();
  const [gstTreatment, setGstTreatment] = useState<GstTreatment | null>(null);
  const [stateCode, setStateCode] = useState<string | null>(null);
  const [showGstErrors, setShowGstErrors] = useState(false);
  const [website, setWebsite] = useState("");

  const showToast = useToast();
  const canEdit = useCanEditOwnership(contact?.createdByUserId ?? null, { own: "contacts.edit_own", others: "contacts.edit_others" });
  // US-PAY-14 — statements show what a customer owes, so they follow the receivables report's capability.
  const canSendStatement = useCapability("reports.view_receivables");
  const [statementOpen, setStatementOpen] = useState(false);
  // US-PAY-17: "Refund" when the customer holds credit (unallocated payments, credit note excess).
  const canRefund = useCapability("payments.refund");
  const [refundOpen, setRefundOpen] = useState(false);
  const [credit, setCredit] = useState<bigint>(0n);
  const [creditKey, setCreditKey] = useState(0);
  const [currency, setCurrency] = useState("USD");
  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => setCurrency(res.value?.code ?? "USD"))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!canRefund) return;
    loadCustomerCredit(contactId)
      .then((list) => setCredit(list.reduce((sum, c) => sum + c.available, 0n)))
      .catch(() => setCredit(0n));
  }, [contactId, canRefund, creditKey]);
  const [timelineKey, setTimelineKey] = useState(0);
  const canDelete = useCanEditOwnership(contact?.createdByUserId ?? null, { own: "contacts.delete_own", others: "contacts.delete_others" });

  async function reloadContact() {
    try {
      const row = await apiClient.get<Contact>(`/contacts/${contactId}`);
      setContact(row);
    } catch (err) {
      if (loadFailed(err)) return;
      setError(err instanceof Error ? err.message : t("contacts.detail.loadError"));
    }
  }

  function reloadLeads() {
    // The leads list endpoint only filters by ?stage, not contactId (per
    // apps/api/src/modules/contacts/leads.controller.ts) — filtering
    // client-side here rather than adding a server-side param this pass
    // doesn't otherwise need, since a single contact's lead count is small.
    apiClient
      .get<Lead[]>("/leads")
      .then((rows) => setLeads(rows.filter((l) => l.contactId === contactId)))
      // US-SET-24: Leads & meetings switched off.
      .catch(() => setLeads([]));
  }

  function reloadActivities() {
    apiClient.get<Activity[]>(`/activities?contactId=${contactId}`).then(setActivities);
  }

  useEffect(() => {
    reloadContact();
    reloadLeads();
    reloadActivities();
  }, [contactId]);

  function startEdit() {
    if (!contact) return;
    setType(contact.type);
    setIsCompany(contact.isCompany);
    setName(contact.name);
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setTaxId(contact.taxId ?? "");
    setGstTreatment(contact.gstTreatment);
    setStateCode(contact.stateCode);
    setShowGstErrors(false);
    setWebsite(contact.website ?? "");
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (taxCountry === "IN" && contactGstError(gstTreatment, taxId, stateCode)) {
      setShowGstErrors(true);
      return;
    }
    setSaving(true);
    try {
      await apiClient.put(`/contacts/${contactId}`, {
        type,
        isCompany,
        name,
        email: email || null,
        phone: phone || null,
        taxId: taxId || null,
        ...(taxCountry === "IN" ? { gstTreatment, stateCode } : {}),
        website: website || null,
      });
      setEditing(false);
      await reloadContact();
      showToast(t("contacts.detail.updatedTitle"), t("contacts.detail.updatedDescription", { name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("contacts.detail.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUploaded(file: SpineFile) {
    await apiClient.put(`/contacts/${contactId}`, { logoFileId: file.id });
    await reloadContact();
  }

  async function handleRemindersPaused(remindersPaused: boolean) {
    setContact((c) => (c ? { ...c, remindersPaused } : c));
    try {
      await apiClient.put(`/contacts/${contactId}`, { remindersPaused });
      showToast(
        remindersPaused ? t("contacts.detail.remindersPausedTitle") : t("contacts.detail.remindersOnTitle"),
        remindersPaused
          ? t("contacts.detail.remindersPausedDescription", { name: contact?.name ?? t("contacts.detail.thisContact") })
          : t("contacts.detail.remindersOnDescription", { name: contact?.name ?? t("contacts.detail.thisContact") }),
      );
    } catch (err) {
      setContact((c) => (c ? { ...c, remindersPaused: !remindersPaused } : c));
      setError(err instanceof Error ? err.message : t("contacts.detail.remindersError"));
    }
  }

  async function handleArchive() {
    setBusy(true);
    try {
      await apiClient.post(`/contacts/${contactId}/archive`);
      await reloadContact();
      showToast(t("contacts.detail.archivedTitle"), t("contacts.detail.archivedDescription", { name: contact?.name ?? t("contacts.detail.thisContact") }));
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    try {
      await apiClient.post(`/contacts/${contactId}/restore`);
      await reloadContact();
      showToast(t("contacts.detail.restoredTitle"), t("contacts.detail.restoredDescription", { name: contact?.name ?? t("contacts.detail.thisContact") }));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setDeleteError(null);
    try {
      const deletedName = contact?.name ?? t("contacts.detail.contactFallback");
      await apiClient.delete(`/contacts/${contactId}`);
      // Shown on the list this opens (D-223).
      showToast(t("contacts.detail.deletedTitle"), t("contacts.detail.deletedDescription", { name: deletedName }));
      router.push("/contacts");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : t("contacts.rowActions.deleteError"),
      );
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const archived = Boolean(contact.archivedAt);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      {/* Explicit back button — Breadcrumb (in the page's own AppShellHeader,
          above this component) already offers "Contacts", but a one-click
          back affordance right next to the identity it returns from reads
          clearer for a detail page one level deep, matching common CRM
          detail-page conventions (Attio/Twenty/Jobber references from the
          prior pass). */}
      <button
        type="button"
        onClick={() => router.push("/contacts")}
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-on-surface-muted transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={14} />
        {t("contacts.detail.back")}
      </button>

      {/* Header row: logo + identity + badges on the left, primary actions top-right. */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div className="flex items-start gap-4">
          <ContactLogo name={contact.name} fileId={contact.logoFileId} size="lg" editable onUploaded={handleLogoUploaded} />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-semibold text-on-surface">{contact.name}</h2>
              <Badge>{TYPE_LABELS[contact.type]}</Badge>
              {contact.isCompany && <Badge>{t("contacts.detail.company")}</Badge>}
              {archived && <Badge>{t("contacts.common.archived")}</Badge>}
            </div>
            <p className="text-[13px] text-on-surface-muted">
              {contact.email ?? t("contacts.common.noEmail")} {contact.phone ? t("contacts.listView.phoneSuffix", { phone: contact.phone }) : ""}
            </p>
            {/* US-TAX-12 — GST treatment, GSTIN and state for an Indian business. */}
            {contact.gstTreatment && (
              <p className="text-[13px] text-on-surface-muted">
                {[GST_TREATMENT_LABELS[contact.gstTreatment], contact.stateCode ? gstStateLabel(contact.stateCode) : null].filter(Boolean).join(" · ")}
              </p>
            )}
            {(contact.taxId || contact.website) && (
              <p className="text-[13px] text-on-surface-muted">
                {contact.taxId ? t("contacts.detail.taxIdLine", { label: gstinRequired(contact.gstTreatment) ? t("contacts.gst.gstin") : t("contacts.gst.taxId"), value: contact.taxId }) : ""}
                {contact.taxId && contact.website ? " · " : ""}
                {contact.website ? (
                  <a href={contact.website} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                    {contact.website}
                  </a>
                ) : (
                  ""
                )}
              </p>
            )}
            {/* US-INV-19 — per-customer opt-out of the automatic reminder run (Settings › Automatic reminders). */}
            {contact.type !== "vendor" &&
              (canEdit ? (
                <div className="flex items-center gap-2">
                  <Switch id="reminders-paused" checked={contact.remindersPaused} onCheckedChange={handleRemindersPaused} />
                  <label htmlFor="reminders-paused" className="text-[13px] text-on-surface">
                    {t("contacts.detail.pauseReminders")}
                  </label>
                </div>
              ) : (
                contact.remindersPaused && <p className="text-[13px] text-on-surface-muted">{t("contacts.detail.remindersPaused")}</p>
              ))}
          </div>
        </div>

        {!editing && (
          <div className="flex items-center gap-2">
            {/* US-SET-13 (D-061): History opens the same dialog as on every other record. */}
            <HistorySection endpoint={`/contacts/${contactId}/history`} subjectLabel={t("contacts.detail.historySubject")} ownEntityType="contact" />
            {canRefund && credit > 0n && contact.type !== "vendor" && (
              <Button variant="secondary" onClick={() => setRefundOpen(true)}>
                {t("contacts.detail.refund")}
              </Button>
            )}
            {canSendStatement && contact.type !== "vendor" && (
              <Button variant="secondary" onClick={() => setStatementOpen(true)}>
                {t("contacts.detail.sendStatement")}
              </Button>
            )}
            {/* Edit is the single primary (filled) action per docs/DESIGN.md; archive/restore/delete are secondary or danger. Each gated by contacts.edit_own/edit_others (Edit) or contacts.delete_own/delete_others (Archive/Restore/Delete) — own vs. others resolved from contact.createdByUserId, mirroring ContactsService's own server-side checks. */}
            {canEdit && (
              <Button variant="primary" onClick={startEdit}>
                {t("contacts.common.edit")}
              </Button>
            )}
            {canDelete &&
              (archived ? (
                <Button variant="secondary" onClick={handleRestore} disabled={busy}>
                  {busy ? <Spinner size="sm" /> : t("contacts.common.restore")}
                </Button>
              ) : (
                <Button variant="secondary" onClick={handleArchive} disabled={busy}>
                  {busy ? <Spinner size="sm" /> : t("contacts.common.archive")}
                </Button>
              ))}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="danger" disabled={busy}>
                    {t("contacts.common.delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("contacts.rowActions.deleteTitle", { name: contact.name })}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("contacts.rowActions.deleteDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("contacts.common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction variant="danger" onClick={handleDelete}>{t("contacts.common.delete")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>

      {deleteError && (
        <Alert variant="critical">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {editing && (
        <div className="flex flex-col gap-4 rounded-lg border border-border-strong bg-surface p-5">
          <h3 className="text-[14px] font-semibold text-on-surface">{t("contacts.detail.editHeading")}</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label={t("contacts.common.type")} required>
              {(field) => (
                <Select value={type} onValueChange={(v) => setType(v as ContactType)}>
                  <SelectTrigger {...field} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-[13px] text-on-surface">
                <Checkbox checked={isCompany} onCheckedChange={(v) => setIsCompany(v === true)} />
                {t("contacts.form.isCompany")}
              </label>
            </div>

            <FormField label={isCompany ? t("contacts.form.companyName") : t("contacts.form.fullName")} required>
              {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} required />}
            </FormField>

            <FormField label={t("contacts.common.email")}>
              {(field) => <Input {...field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </FormField>

            <FormField label={t("contacts.common.phone")}>
              {(field) => <Input {...field} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
            </FormField>

            {taxCountry === "IN" ? (
              <ContactGstFields
                treatment={gstTreatment}
                gstin={taxId}
                stateCode={stateCode}
                onTreatmentChange={setGstTreatment}
                onGstinChange={setTaxId}
                onStateCodeChange={setStateCode}
                showErrors={showGstErrors}
              />
            ) : (
              <FormField label={t("contacts.gst.taxId")}>
                {(field) => <Input {...field} value={taxId} onChange={(e) => setTaxId(e.target.value)} />}
              </FormField>
            )}

            <FormField label={t("contacts.form.website")}>
              {/* eslint-disable-next-line i18next/no-literal-string -- a URL scheme hint, not copy */}
              {(field) => <Input {...field} type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />}
            </FormField>
          </div>

          <div className="flex gap-2">
            <Button variant="primary" disabled={saving || !name} onClick={handleSaveEdit}>
              {saving ? <Spinner size="sm" /> : t("contacts.common.save")}
            </Button>
            <Button variant="secondary" disabled={saving} onClick={() => setEditing(false)}>
              {t("contacts.common.cancel")}
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">{t("contacts.detail.tabTimeline")}</TabsTrigger>
          <TabsTrigger value="persons">{t("contacts.persons.heading")}</TabsTrigger>
          <TabsTrigger value="addresses">{t("contacts.addresses.heading")}</TabsTrigger>
          {leadsOn && <TabsTrigger value="leads">{t("contacts.detail.tabLeads")}</TabsTrigger>}
          <TabsTrigger value="activities">{t("contacts.activities.heading")}</TabsTrigger>
          <TabsTrigger value="attachments">{t("contacts.detail.tabAttachments")}</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <TimelineSection key={timelineKey} contactId={contactId} />
        </TabsContent>
        <TabsContent value="persons">
          <ContactPersonsSection
            contact={contact}
            onSaved={reloadContact}
            onCreated={() => showToast(t("contacts.detail.personAddedTitle"), t("contacts.detail.personAddedDescription"))}
          />
        </TabsContent>
        <TabsContent value="addresses">
          <AddressesSection
            contact={contact}
            onSaved={reloadContact}
            onCreated={() => showToast(t("contacts.detail.addressAddedTitle"), t("contacts.detail.addressAddedDescription"))}
          />
        </TabsContent>
        {leadsOn && (
          <TabsContent value="leads">
            <LeadsSection
              contactId={contactId}
              leads={leads}
              onChanged={reloadLeads}
              onCreated={() => showToast(t("contacts.detail.leadAddedTitle"), t("contacts.detail.leadAddedDescription"))}
            />
          </TabsContent>
        )}
        <TabsContent value="activities">
          <ActivitiesSection
            contactId={contactId}
            activities={activities}
            onChanged={reloadActivities}
            onCreated={() => showToast(t("contacts.detail.activityLoggedTitle"), t("contacts.detail.activityLoggedDescription"))}
          />
        </TabsContent>
        <TabsContent value="attachments">
          <AttachmentsSection entityType="contact" entityId={contactId} />
        </TabsContent>
      </Tabs>

      <CustomerRefundDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        contactId={contactId}
        contactName={contact.name}
        currency={currency}
        onRefunded={(refund) => {
          setCreditKey((k) => k + 1);
          setTimelineKey((k) => k + 1);
          const { title, description } = refundToast(refund);
          showToast(title, description);
        }}
      />

      <StatementDialog
        open={statementOpen}
        onOpenChange={setStatementOpen}
        contactId={contactId}
        contactEmail={contact.email}
        onSent={(sentTo) => {
          setStatementOpen(false);
          setTimelineKey((k) => k + 1);
          showToast(t("contacts.detail.statementSentTitle"), t("contacts.detail.statementSentDescription", { to: sentTo }));
        }}
      />
    </div>
  );
}
