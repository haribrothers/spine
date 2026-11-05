"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Badge,
  Breadcrumb,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  cn,
} from "@spine/ui";
import { CalendarDays, Check, ChevronDown, Flag, GitBranch, LockOpen, MapPin, Pencil, Receipt, User } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";
import { authClient } from "../../../lib/auth-client";
import { useCanEditOwnership, useCapabilities, useCapability } from "../../../lib/capabilities-context";
import { HistorySection } from "../../../components/history-section";
import { CompleteMilestoneDialog } from "./[id]/complete-milestone-dialog";
import { CostingSection } from "./[id]/costing-section";
import { CrewSection } from "./[id]/crew-section";
import { JobActivity } from "./[id]/job-activity";
import { MilestonesSection } from "./[id]/milestones-section";
import { NotesSection } from "./[id]/notes-section";
import { PhotosSection } from "./[id]/photos-section";
import { VariationOrdersSection } from "./[id]/variation-orders-section";
import { useToast } from "../../../components/toast-host";
import { completePct } from "./jobs-list-state";
import { nextStep } from "./job-page-state";
import { STATUS_BADGE_CLASS } from "./jobs-table";
import { calendarDate } from "../quotes/quotes-list-state";
import { JOB_STATUS_LABELS, type Job, type JobCostingReport, type JobStatus, type JobVariationOrder, type Milestone } from "./types";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { BUDGET_NOT_NEGATIVE, PERCENT_COMPLETE_RANGE, fromDecimalString, minorUnitExponent } from "@spine/shared";

import { SectionLink } from "../../../components/section-link";
import { useLoadFailure } from "../../../lib/use-load-failure";
const JOB_TABS = ["milestones", "variations", "photos", "notes", "crew", "costing"] as const;
type JobTab = (typeof JOB_TABS)[number];

const STATUS_DOT: Record<JobStatus, string> = {
  active: "bg-due-soon",
  on_hold: "bg-draft",
  completed: "bg-paid",
  cancelled: "bg-overdue",
};

interface Counts {
  photos: number;
  notes: number;
  crew: number;
}

/** A Google Maps search for the site, opened in a new tab (US-JOB-34). */
function mapLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/\s*\n\s*/g, ", "))}`;
}

/**
 * Job detail. US-JOB-34 to US-JOB-37 (D-215): the number is the page title,
 * with a status menu, the name, contact, site (opens a map), dates and the
 * quote it came from; one primary button is the next step (invoice a
 * completed milestone, complete the next one, or release retention); a
 * strip of figures (Field users see only % complete); tabs with counts;
 * milestones as progress beside the job's Activity.
 *
 * **Capability gating**: own/others split (PRD §2.1, §9 Phase 3) via
 * `useCapability`/`useCanEditOwnership` (`capabilities-context.tsx`).
 * Hiding a button is UI signal only — the server independently re-checks
 * every mutating request.
 */
export function JobDetail({ jobId, currentUserId: _currentUserId }: { jobId: string; currentUserId: string | null }) {
  const t = useT();
  const loadFailed = useLoadFailure(jobId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab: JobTab = JOB_TABS.includes(requestedTab as JobTab) ? (requestedTab as JobTab) : "milestones";
  const [activeTab, setActiveTab] = useState<JobTab>(initialTab);
  const [job, setJob] = useState<Job | null>(null);
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [variations, setVariations] = useState<JobVariationOrder[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [costing, setCosting] = useState<JobCostingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isConstruction, setIsConstruction] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completing, setCompleting] = useState<Milestone | null>(null);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const [raiseRequest, setRaiseRequest] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  // US-DASH-20: the dashboard's "Release" opens ?release=1 — the dialog, once the job shows it can be released.
  const wantsRelease = searchParams.get("release") === "1";
  const showToast = useToast();
  const now = useMemo(() => new Date(), []);
  const locale = orgLocaleTag();

  const canEditJob = useCanEditOwnership(job?.createdByUserId ?? null, { own: "jobs.edit_own", others: "jobs.edit_others" });
  const canReleaseRetention = useCapability("jobs.release_retention");
  const canInvoice = useCapability("milestones.invoice");
  const canRaiseVariation = useCapability("variation_orders.edit_own");
  // US-JOB-19: job costing is financial reporting; Field never has this grant.
  const canViewCosting = useCapability("reports.view_job_profitability");
  const { capabilities } = useCapabilities();
  const { data: session } = authClient.useSession();

  /** Per-milestone "mark complete": `milestones.edit_own` for the milestones the person set, else `edit_others` (Field always has both). */
  const canComplete = useCallback(
    (m: Milestone): boolean => {
      if (!capabilities || !session?.user?.id) return false;
      const isOwn = m.createdByUserId !== null && m.createdByUserId === session.user.id;
      return capabilities[isOwn ? "milestones.edit_own" : "milestones.edit_others"] ?? false;
    },
    [capabilities, session?.user?.id],
  );

  const load = useCallback(() => {
    apiClient
      .get<Job>(`/jobs/${jobId}?include=billing`)
      .then(setJob)
      .catch((err) => loadFailed(err) || setError(err instanceof Error ? err.message : t("jobs.detail.loadFailed")));
    apiClient
      .get<Milestone[]>(`/jobs/${jobId}/milestones`)
      .then(setMilestones)
      .catch(() => setMilestones([]));
    apiClient
      .get<JobVariationOrder[]>(`/jobs/${jobId}/variation-orders`)
      .then(setVariations)
      .catch(() => {});
    // US-JOB-35: the tab counts.
    Promise.all([apiClient.get<unknown[]>(`/jobs/${jobId}/photos`), apiClient.get<unknown[]>(`/jobs/${jobId}/notes`), apiClient.get<unknown[]>(`/jobs/${jobId}/assignees`)])
      .then(([photos, notes, crew]) => setCounts({ photos: photos.length, notes: notes.length, crew: crew.length }))
      .catch(() => {});
    setRefreshKey((k) => k + 1);
  }, [jobId, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canViewCosting) return;
    apiClient
      .get<JobCostingReport>(`/jobs/${jobId}/costing`)
      .then(setCosting)
      .catch(() => {});
  }, [jobId, canViewCosting, refreshKey]);

  // S-12.3 — the org's industry template decides whether the retention-% disclosure in EditJobDialog starts open.
  useEffect(() => {
    apiClient
      .get<{ key: string; value: { template?: string } | null }>("/org/settings/industry_template")
      .then((res) => setIsConstruction(res.value?.template === "construction"))
      .catch(() => {});
  }, []);

  const held = BigInt(job?.retentionHeld ?? "0");
  const canRelease = canReleaseRetention && held > 0n;
  const releaseAsked = useRef(false);
  useEffect(() => {
    if (wantsRelease && !releaseAsked.current && job && canRelease) {
      releaseAsked.current = true;
      setReleaseOpen(true);
    }
  }, [wantsRelease, job, canRelease]);

  async function handleReleaseRetention() {
    if (!job) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/jobs/${job.id}/release-retention`);
      setReleaseOpen(false);
      load();
      showToast(t("jobs.detail.retentionReleased"), t("jobs.detail.retentionReleasedDescription"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("jobs.detail.releaseFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleInvoice(m: Milestone) {
    if (!job) return;
    setError(null);
    setInvoicingId(m.id);
    try {
      const invoice = await apiClient.post<{ id: string }>(`/jobs/${job.id}/milestones/${m.id}/invoice`);
      showToast(t("jobs.detail.invoiced", { name: m.name }), t("jobs.detail.invoicedDescription"));
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("jobs.detail.invoiceFailed"));
      setInvoicingId(null);
    }
  }

  /** US-JOB-34 — saves at once; Cancelled asks first. */
  async function changeStatus(status: JobStatus, confirmed = false) {
    if (!job || status === job.status) return;
    if (status === "cancelled" && !confirmed) {
      setCancelOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiClient.put<Job>(`/jobs/${job.id}`, { status });
      setCancelOpen(false);
      load();
      showToast(t("jobs.detail.statusChanged"), t("jobs.detail.statusChangedDescription", { title: job.number ?? job.name, status: JOB_STATUS_LABELS[status].toLowerCase() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("jobs.detail.statusFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (error && !job) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!job) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const withMoney = job.contractValueAmount !== undefined;
  const step = milestones ? nextStep(job, milestones, { invoice: canInvoice, complete: canComplete, release: canRelease }) : null;
  const title = job.number ?? job.name;
  const applied = variations.filter((v) => v.appliedAt);
  const appliedTotal = applied.reduce((sum, v) => sum + BigInt(v.quote.totalAmount), 0n);
  const complete = completePct({ ...job, milestoneCounts: milestones ? { total: milestones.length, completed: milestones.filter((m) => m.status !== "pending").length } : undefined });
  const dates = [job.startDate ? t(new Date(job.startDate) > now ? "jobs.detail.starts" : "jobs.detail.started", { date: calendarDate(job.startDate, now, locale) }) : null, job.endDate ? t("jobs.due.on", { date: calendarDate(job.endDate, now, locale) }) : null].filter(Boolean).join(" · ");

  const stepIcon = step?.kind === "invoice" ? <Receipt size={15} aria-hidden /> : step?.kind === "complete" ? <Flag size={15} aria-hidden /> : <LockOpen size={15} aria-hidden />;
  const count = (n: number | undefined) =>
    n === undefined ? null : (
      <span className="ml-1.5 rounded-full bg-surface-sunken px-1.5 text-[11px] font-semibold tabular-nums text-on-surface-muted" aria-label={`, ${n}`}>
        {n}
      </span>
    );

  const figure = (label: string, value: string, note: React.ReactNode, bar?: number, testId?: string) => (
    <div key={label} className="flex min-w-0 flex-col gap-1 border-border p-4 [&:not(:last-child)]:border-b sm:[&:not(:last-child)]:border-r sm:[&:not(:last-child)]:border-b-0" data-testid={testId}>
      <span className="text-[12.5px] text-on-surface-muted">{label}</span>
      <span className="text-[19px] font-bold tabular-nums leading-tight text-on-surface">{value}</span>
      <span className="text-[12px] text-on-surface-muted">{note}</span>
      {bar !== undefined && (
        <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
          <span className={cn("block h-full rounded-full", bar > 100 ? "bg-overdue" : "bg-primary")} style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
        </span>
      )}
    </div>
  );

  const budget = costing?.budget;
  const figures = withMoney
    ? [
        figure(
          t("jobs.detail.figContract"),
          formatMoney(BigInt(job.contractValueAmount ?? "0"), job.currency),
          applied.length ? t("jobs.detail.inclVariations", { count: applied.length, amount: formatMoney(appliedTotal, job.currency) }) : (job.retentionPct ?? 0) > 0 ? t("jobs.detail.retentionPct", { pct: job.retentionPct }) : t("jobs.detail.noVariations"),
          undefined,
          "fig-contract",
        ),
        figure(t("jobs.detail.figBilled"), formatMoney(BigInt(job.billedAmount ?? "0"), job.currency), job.billedPct === null || job.billedPct === undefined ? t("jobs.detail.noContractValue") : t("jobs.detail.pctOfContract", { pct: job.billedPct }), job.billedPct ?? 0, "fig-billed"),
        ...(costing
          ? [
              figure(
                t("jobs.detail.figCost"),
                formatMoney(BigInt(costing.cost), job.currency),
                budget?.amount ? (
                  <span className={budget.state === "over" ? "font-medium text-overdue" : budget.state === "near" ? "font-medium text-due-soon" : "text-paid"}>
                    {t("jobs.detail.pctOfBudget", { pct: String(budget.usedPct), amount: formatMoney(BigInt(budget.amount), job.currency) })}
                  </span>
                ) : (
                  t("jobs.detail.noBudget")
                ),
                undefined,
                "fig-cost",
              ),
              figure(t("jobs.detail.figMargin"), formatMoney(BigInt(costing.margin), job.currency), costing.marginPct === null ? t("jobs.detail.nothingBilled") : t("jobs.detail.pctSoFar", { pct: costing.marginPct }), undefined, "fig-margin"),
            ]
          : []),
        figure(t("jobs.detail.figComplete"), complete === null ? "—" : `${complete}%`, job.percentComplete != null ? t("jobs.detail.yourEstimate") : complete === null ? t("jobs.detail.notSet") : t("jobs.detail.fromMilestones"), undefined, "fig-complete"),
      ]
    : [figure(t("jobs.detail.figComplete"), complete === null ? "—" : `${complete}%`, job.percentComplete != null ? t("jobs.detail.yourEstimate") : complete === null ? t("jobs.detail.notSet") : t("jobs.detail.fromMilestones"), undefined, "fig-complete")];

  return (
    <div className="flex flex-col gap-5">
      {/* US-JOB-34: the number is the page title; the breadcrumb leads back to Jobs. */}
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: t("jobs.page.title"), href: "/jobs" }, { label: title }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[18rem] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-bold leading-tight tracking-tight text-on-surface">{title}</h1>
              {canEditJob ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={t("jobs.detail.statusAria", { status: JOB_STATUS_LABELS[job.status] })}
                      className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", STATUS_BADGE_CLASS[job.status])}
                      data-testid="job-status"
                    >
                      {JOB_STATUS_LABELS[job.status]}
                      <ChevronDown size={13} aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {(Object.keys(JOB_STATUS_LABELS) as JobStatus[]).map((status) => (
                      <DropdownMenuItem key={status} onSelect={() => void changeStatus(status)}>
                        <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} aria-hidden />
                        {JOB_STATUS_LABELS[status]}
                        {status === job.status && <Check size={14} className="ml-auto text-primary" aria-label={t("jobs.detail.current")} />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Badge className={STATUS_BADGE_CLASS[job.status]} data-testid="job-status">
                  {JOB_STATUS_LABELS[job.status]}
                </Badge>
              )}
            </div>
            {job.number && (
              <p className="text-[15px] font-medium text-on-surface" data-testid="job-name">
                {job.name}
              </p>
            )}
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-on-surface-muted" data-testid="job-meta">
              <span className="inline-flex items-center gap-1.5">
                <User size={14} aria-hidden />
                <SectionLink href={`/contacts/${job.contactId}`} className="font-medium text-primary hover:underline">
                  {job.contactName ?? t("jobs.list.unknownContact")}
                </SectionLink>
              </span>
              {job.siteAddress && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin size={14} aria-hidden />
                  <a href={mapLink(job.siteAddress)} target="_blank" rel="noreferrer" className="truncate font-medium text-primary hover:underline" aria-label={t("jobs.detail.opensMap", { address: job.siteAddress })}>
                    {job.siteAddress.replace(/\s*\n\s*/g, ", ")}
                  </a>
                </span>
              )}
              {dates && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} aria-hidden />
                  {dates}
                </span>
              )}
              {job.sourceQuoteId && (
                <span>
                  {t("jobs.detail.from")}{" "}
                  <SectionLink href={`/quotes/${job.sourceQuoteId}`} className="font-medium text-primary hover:underline">
                    {job.sourceQuoteNumber ?? t("jobs.detail.itsQuote")}
                  </SectionLink>
                </span>
              )}
            </p>
            {job.notes && <p className="mt-1 max-w-3xl whitespace-pre-wrap text-[13px] text-on-surface-muted">{job.notes}</p>}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2" data-testid="job-actions">
            {canEditJob && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil size={15} aria-hidden />
                {t("jobs.detail.editJob")}
              </Button>
            )}
            {canRaiseVariation && withMoney && (
              <Button
                variant="secondary"
                onClick={() => {
                  setActiveTab("variations");
                  setRaiseRequest((n) => n + 1);
                }}
              >
                <GitBranch size={15} aria-hidden />
                {t("jobs.detail.raiseVariation")}
              </Button>
            )}
            {step && (
              <Button
                disabled={busy || invoicingId !== null}
                onClick={() => {
                  if (step.kind === "invoice") void handleInvoice(step.milestone);
                  else if (step.kind === "complete") setCompleting(step.milestone);
                  else setReleaseOpen(true);
                }}
                data-testid="job-next-step"
              >
                {invoicingId ? <Spinner size="sm" /> : stepIcon}
                {step.label}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  {t("jobs.detail.more")} <ChevronDown size={14} aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setActiveTab("photos")}>
                  <MENU_ICONS.addPhotos aria-hidden />
                  {t("jobs.detail.addPhotos")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                  <MENU_ICONS.history aria-hidden />
                  {t("jobs.detail.viewHistory")}
                </DropdownMenuItem>
                {canRelease && step?.kind !== "release" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setReleaseOpen(true)}>
                      <MENU_ICONS.releaseRetention aria-hidden />
                      {t("jobs.next.releaseRetention")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <HistorySection endpoint={`/jobs/${job.id}/history`} subjectLabel={t("jobs.detail.historySubject")} open={historyOpen} onOpenChange={setHistoryOpen} />
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className={cn("grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface", figures.length >= 5 ? "md:grid-cols-5" : figures.length === 3 ? "md:grid-cols-3" : figures.length === 1 ? "sm:max-w-xs" : "md:grid-cols-2")} data-testid="job-figures">
        {figures}
      </div>

      <Tabs value={activeTab === "costing" && !canViewCosting ? "milestones" : activeTab} onValueChange={(value) => setActiveTab(value as JobTab)}>
        <TabsList>
          <TabsTrigger value="milestones">{t("jobs.detail.tabMilestones")}{count(milestones?.length)}</TabsTrigger>
          <TabsTrigger value="variations">{t("jobs.detail.tabVariations")}{count(variations.length)}</TabsTrigger>
          <TabsTrigger value="photos">{t("jobs.detail.tabPhotos")}{count(counts?.photos)}</TabsTrigger>
          <TabsTrigger value="notes">{t("jobs.detail.tabNotes")}{count(counts?.notes)}</TabsTrigger>
          <TabsTrigger value="crew">{t("jobs.detail.tabCrew")}{count(counts?.crew)}</TabsTrigger>
          {canViewCosting && <TabsTrigger value="costing">{t("jobs.detail.tabCosting")}</TabsTrigger>}
        </TabsList>
        <TabsContent value="milestones">
          <div className={cn("grid grid-cols-1 items-start gap-5", withMoney && "xl:grid-cols-[minmax(0,1fr)_340px]")}>
            <MilestonesSection
              job={job}
              milestones={milestones}
              onChanged={load}
              canComplete={canComplete}
              canInvoice={canInvoice}
              onComplete={setCompleting}
              onInvoice={(m) => void handleInvoice(m)}
              invoicingId={invoicingId}
            />
            {/* US-JOB-37: Field users get no Activity. */}
            {withMoney && <JobActivity jobId={job.id} currency={job.currency} refreshKey={refreshKey} onViewHistory={() => setHistoryOpen(true)} />}
          </div>
        </TabsContent>
        <TabsContent value="variations">
          <VariationOrdersSection job={job} onJobChanged={load} raiseRequest={raiseRequest} />
        </TabsContent>
        <TabsContent value="photos">
          <PhotosSection job={job} milestones={milestones ?? []} onChanged={load} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesSection job={job} onChanged={load} />
        </TabsContent>
        <TabsContent value="crew">
          <CrewSection job={job} onChanged={load} />
        </TabsContent>
        {canViewCosting && (
          <TabsContent value="costing">
            <CostingSection job={job} onEditJob={canEditJob ? () => setEditOpen(true) : undefined} />
          </TabsContent>
        )}
      </Tabs>

      <CompleteMilestoneDialog
        job={job}
        milestone={completing}
        onOpenChange={(open) => !open && setCompleting(null)}
        onCompleted={() => {
          if (completing) showToast(t("jobs.detail.completed", { name: completing.name }), t("jobs.detail.completedDescription"));
          setCompleting(null);
          load();
        }}
      />

      <EditJobDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        job={job}
        defaultShowRetention={isConstruction}
        onSaved={(updated) => {
          setEditOpen(false);
          load();
          showToast(t("jobs.detail.updated"), t("jobs.detail.updatedDescription", { name: updated.name }));
        }}
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("jobs.detail.cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("jobs.detail.cancelDescription", { title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("jobs.detail.keepJob")}</AlertDialogCancel>
            <AlertDialogAction variant="danger" disabled={busy} onClick={() => void changeStatus("cancelled", true)}>
              {busy ? <Spinner size="sm" /> : t("jobs.detail.cancelJob")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pure yes/no confirmation with a real ledger effect (posts a new invoice + journal entry) — AlertDialog, not Dialog. */}
      <AlertDialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("jobs.detail.releaseTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("jobs.detail.releaseDescription", { amount: held > 0n ? formatMoney(held, job.currency) : t("jobs.detail.retentionFallback") })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("jobs.detail.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={handleReleaseRetention}>
              {busy ? <Spinner size="sm" /> : t("jobs.next.releaseRetention")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

/**
 * Edit job dialog — status, dates, notes, and retention %. Retention lives
 * behind a collapsible "Advanced" disclosure rather than a top-level field
 * — see this task's own S-12.3 judgment call (documented in the final
 * report): retention is a construction-specific concern the PRD's "simple
 * by default, capable underneath" principle says shouldn't clutter every
 * org's edit form, but it must stay fully reachable/editable for any org
 * regardless of industry template (never a hard gate).
 */
function EditJobDialog({
  open,
  onOpenChange,
  job,
  defaultShowRetention,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  /** S-12.3 — true when the org's industry template is "construction" (JobDetail's own read of GET /org/settings/industry_template). Only affects whether the disclosure starts open; a job that already has a nonzero retentionPct always starts open regardless, and every org can open it manually either way — see this component's own doc comment. */
  defaultShowRetention: boolean;
  onSaved: (job: Job) => void;
}) {
  const t = useT();
  const [name, setName] = useState(job.name);
  const [siteAddress, setSiteAddress] = useState(job.siteAddress ?? "");
  const [status, setStatus] = useState<JobStatus>(job.status);
  const [startDate, setStartDate] = useState<Date | undefined>(job.startDate ? new Date(job.startDate) : undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(job.endDate ? new Date(job.endDate) : undefined);
  const [retentionPct, setRetentionPct] = useState(job.retentionPct ?? 0);
  const [notes, setNotes] = useState(job.notes ?? "");
  const [budget, setBudget] = useState(budgetText(job));
  const [budgetError, setBudgetError] = useState<string | undefined>();
  const [percentComplete, setPercentComplete] = useState(job.percentComplete == null ? "" : String(job.percentComplete));
  const [percentError, setPercentError] = useState<string | undefined>();
  const [advancedOpen, setAdvancedOpen] = useState((job.retentionPct ?? 0) > 0 || defaultShowRetention);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(job.name);
    setSiteAddress(job.siteAddress ?? "");
    setStatus(job.status);
    setStartDate(job.startDate ? new Date(job.startDate) : undefined);
    setEndDate(job.endDate ? new Date(job.endDate) : undefined);
    setRetentionPct(job.retentionPct ?? 0);
    setNotes(job.notes ?? "");
    setBudget(budgetText(job));
    setBudgetError(undefined);
    setPercentComplete(job.percentComplete == null ? "" : String(job.percentComplete));
    setPercentError(undefined);
    setAdvancedOpen((job.retentionPct ?? 0) > 0 || defaultShowRetention);
    setError(null);
  }, [open, job, defaultShowRetention]);

  async function handleSave() {
    if (!name.trim()) {
      setError(t("jobs.edit.nameRequired"));
      return;
    }
    // US-JOB-24 — blank means "not budgeted".
    const budgetAmount = budget.trim() ? fromDecimalString(budget.replace(/,/g, "").trim(), job.currency) : null;
    if (budget.trim() && (budgetAmount === null || budgetAmount < 0n)) {
      setBudgetError(BUDGET_NOT_NEGATIVE);
      return;
    }
    setBudgetError(undefined);
    // US-JOB-28 — blank means "not set".
    const percent = percentComplete.trim() === "" ? null : Number(percentComplete);
    if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) {
      setPercentError(PERCENT_COMPLETE_RANGE);
      return;
    }
    setPercentError(undefined);
    setSaving(true);
    setError(null);
    try {
      const updated = await apiClient.put<Job>(`/jobs/${job.id}`, {
        ...(job.costBudgetAmount !== undefined ? { costBudgetAmount: budgetAmount === null ? null : budgetAmount.toString() } : {}),
        percentComplete: percent,
        name: name.trim(),
        siteAddress: siteAddress || null,
        status,
        startDate: startDate ? startDate.toISOString().slice(0, 10) : null,
        endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
        retentionPct,
        notes: notes || null,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("jobs.edit.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("jobs.edit.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <FormField label={t("jobs.edit.jobName")} required>
            {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label={t("jobs.edit.siteAddress")}>
            {(field) => <Input {...field} value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} placeholder={t("jobs.edit.optional")} />}
          </FormField>
          <FormField label={t("jobs.edit.status")} required>
            {() => (
              <Select value={status} onValueChange={(v) => setStatus(v as JobStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label={t("jobs.edit.startDate")}>{() => <DatePicker value={startDate} onChange={setStartDate} />}</FormField>
            <FormField label={t("jobs.edit.endDate")}>{() => <DatePicker value={endDate} onChange={setEndDate} />}</FormField>
          </div>
          <FormField label={t("jobs.edit.notes")}>
            {(field) => <Textarea {...field} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}
          </FormField>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-[13px] font-medium text-on-surface-muted hover:text-on-surface"
              >
                <ChevronDown size={14} className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                {t("jobs.edit.advanced")}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <FormField label={t("jobs.edit.retention")} helperText={t("jobs.edit.retentionHelper")}>
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={String(retentionPct)}
                    onChange={(e) => setRetentionPct(Number(e.target.value) || 0)}
                  />
                )}
              </FormField>
            </CollapsibleContent>
          </Collapsible>

          {job.costBudgetAmount !== undefined && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <h3 className="text-[13px] font-semibold text-on-surface">{t("jobs.edit.budgetHeading")}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label={t("jobs.edit.costBudget")} helperText={t("jobs.edit.costBudgetHelper")} errorText={budgetError}>
                  {(field) => <Input {...field} inputMode="decimal" className="text-right tabular-nums" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="—" />}
                </FormField>
                <FormField label={t("jobs.edit.percentComplete")} helperText={t("jobs.edit.percentCompleteHelper")} errorText={percentError}>
                  {(field) => (
                    <Input {...field} inputMode="decimal" className="text-right tabular-nums" value={percentComplete} onChange={(e) => setPercentComplete(e.target.value)} placeholder="—" />
                  )}
                </FormField>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("jobs.edit.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : t("jobs.edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The budget as the field shows it ("32000.00"), or blank when the job has none. */
function budgetText(job: Job): string {
  if (!job.costBudgetAmount) return "";
  // An editable number, not a display amount: digits and a decimal point only.
  const exp = minorUnitExponent(job.currency);
  const digits = job.costBudgetAmount.padStart(exp + 1, "0");
  return exp ? `${digits.slice(0, -exp)}.${digits.slice(-exp)}` : digits;
}
