"use client";

import { BookOpen, Eye, ListChecks, Sparkles, Users } from "lucide-react";
import { formatMoney, taxPreset, type TaxCountry } from "@spine/shared";
import type { OnboardingStepKey } from "./onboarding-stages";

export interface PreviewData {
  business: { name?: string; logoUrl?: string; address?: string };
  currency: { code: string; locale: string };
  /** The tax line: a country's preset (its usual rate) or the one default rate; null until the Tax step. */
  tax: { label: string; percentage: number } | null;
  invoiceNumber: string;
  /** Accounts per type, from `GET /org/accounts`; null while loading. */
  accounts: Record<string, number> | null;
  owner: string;
  invites: { email: string; role: "staff" | "field" }[];
  /** "India (GST)" — the tax country's label, for the recap. */
  taxCountryLabel: string | null;
}

/** An example line on the preview: 125,000.00 in whatever currency the owner picks. */
const EXAMPLE_AMOUNT = 12_500_000n;

/**
 * The usual rate for a preset country: India's standard slab (CGST 9% +
 * SGST 9%), otherwise the country's highest standard rate (VAT 20%, GST 10%…).
 */
export function presetTaxLine(country: TaxCountry | null | undefined): { label: string; percentage: number } | null {
  if (!country) return null;
  const preset = taxPreset(country);
  if (!preset) return null;
  if (country === "IN") return { label: "CGST 9% + SGST 9%", percentage: 18 };
  const standard = preset.rates.filter((r) => !r.archived && r.rate > 0).sort((a, b) => b.rate - a.rate)[0];
  return standard ? { label: standard.name, percentage: standard.rate } : null;
}

/** Tax on the example line, half-up to the minor unit, like a document line. */
function taxOn(amount: bigint, percentage: number): bigint {
  const basisPoints = BigInt(Math.round(percentage * 100));
  return (amount * basisPoints + 5_000n) / 10_000n;
}

function formatToday(locale: string): string {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-US", options).format(new Date());
  }
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? "").slice(0, 2)).toUpperCase();
}

const ACCOUNT_GROUPS: { type: string; label: string }[] = [
  { type: "asset", label: "Assets" },
  { type: "liability", label: "Liabilities" },
  { type: "equity", label: "Equity" },
  { type: "income", label: "Income" },
  { type: "expense", label: "Expenses" },
];

/** What the current step changes on the invoice, ringed so the owner sees it. */
const HIGHLIGHT: Partial<Record<OnboardingStepKey, "brand" | "money" | "tax" | "number">> = {
  profile: "brand",
  currency: "money",
  tax: "tax",
  numbering: "number",
};

const RING = "rounded-md ring-2 ring-primary/55 ring-offset-2 ring-offset-surface";

/**
 * US-ONB-22 (D-208) — beside the wizard from 1280 px: the start of the
 * owner's first invoice, built from what they've typed (saved or not), then
 * their books and team in the last stage. Money goes through `formatMoney`,
 * as on every document. Decorative: the form says everything this does.
 */
export function OnboardingPreview({ step, data }: { step: OnboardingStepKey; data: PreviewData }) {
  const books = step === "accounts" || step === "team";
  return (
    <section aria-hidden data-testid="onboarding-preview" className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-on-surface">
        <Eye size={15} className="text-primary" aria-hidden />
        {books ? "Preview · your books and team" : "Preview · your first invoice"}
        <span className="ml-auto text-[12px] font-normal text-on-surface-muted">{books ? "Updates as you go" : "Updates as you type"}</span>
      </div>
      {books ? <BooksAndTeam data={data} /> : <InvoicePaper step={step} data={data} />}
    </section>
  );
}

function InvoicePaper({ step, data }: { step: OnboardingStepKey; data: PreviewData }) {
  const ring = HIGHLIGHT[step];
  const { code, locale } = data.currency;
  const tax = data.tax ? taxOn(EXAMPLE_AMOUNT, data.tax.percentage) : 0n;
  const name = data.business.name?.trim() || "Your business";
  const note = {
    brand: "Your name, logo and address appear as you type.",
    money: "Amounts and dates use your currency and locale.",
    tax: "Your tax shows on each line.",
    number: `Your first invoice will be ${data.invoiceNumber}.`,
  }[ring ?? "brand"];

  return (
    <>
      <div className="rounded-xl bg-surface p-5 text-on-surface shadow-[var(--shadow-overlay)] dark:border dark:border-border">
        <div className="flex gap-3">
          <div className={`flex gap-3 p-1 ${ring === "brand" ? RING : ""}`}>
            {data.business.logoUrl ? (
              <img src={data.business.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-[9px] object-contain" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-[linear-gradient(135deg,var(--color-brand-layer-top-from),var(--color-brand-deep))] text-[15px] font-bold text-on-primary">
                {data.business.name?.trim() ? initials(data.business.name) : "?"}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-[14px] font-bold">{name}</div>
              {data.business.address && <div className="whitespace-pre-line text-[11px] leading-snug text-on-surface-muted">{data.business.address}</div>}
            </div>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <div className="text-[12px] font-bold tracking-[0.08em] text-on-surface-muted">INVOICE</div>
            <div className={`mt-0.5 font-mono text-[14px] font-semibold ${ring === "number" ? RING : ""}`}>{data.invoiceNumber}</div>
            <div className={`mt-0.5 text-[11px] text-on-surface-muted ${ring === "money" ? RING : ""}`}>Issued {formatToday(locale)}</div>
          </div>
        </div>
        <div className="mt-4 text-[10px] font-medium uppercase tracking-[0.06em] text-on-surface-muted">Bill to</div>
        <i className="mt-1.5 block h-[7px] w-[46%] rounded-full bg-border" />
        <i className="mt-1.5 block h-[7px] w-[30%] rounded-full bg-border" />
        <div className="mt-4 border-t border-border text-[12px]">
          <div className="flex items-center gap-2.5 border-b border-border py-2.5">
            <span>Example item</span>
            <span className="text-on-surface-muted">1</span>
            <span className={`ml-auto font-medium tabular-nums ${ring === "money" ? RING : ""}`}>{formatMoney(EXAMPLE_AMOUNT, code, locale)}</span>
          </div>
          <div className={`flex items-center gap-2.5 border-b border-border py-2.5 ${data.tax ? "" : "italic text-on-surface-muted"} ${ring === "tax" ? `${RING} px-1.5` : ""}`}>
            <span>{data.tax ? data.tax.label : "Tax — set in the Tax step"}</span>
            <span className="ml-auto font-medium tabular-nums">{data.tax ? formatMoney(tax, code, locale) : "—"}</span>
          </div>
        </div>
        <div className="mt-3 flex justify-between text-[14px] font-bold tabular-nums">
          <span>Total</span>
          <span className={ring === "money" ? RING : ""}>{formatMoney(EXAMPLE_AMOUNT + tax, code, locale)}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {["Payment details", "Notes"].map((title) => (
            <div key={title}>
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-on-surface-muted">{title}</div>
              <i className="mt-1.5 block h-[7px] w-[80%] rounded-full bg-border" />
              <i className="mt-1.5 block h-[7px] w-[55%] rounded-full bg-border" />
            </div>
          ))}
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-on-surface-muted">
        <Sparkles size={14} className="shrink-0 text-primary" aria-hidden />
        {note}
      </p>
    </>
  );
}

function Box({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface px-[18px] py-4 shadow-[var(--shadow-overlay)] dark:border dark:border-border">
      <h4 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-on-surface">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}

function BooksAndTeam({ data }: { data: PreviewData }) {
  const most = Math.max(1, ...ACCOUNT_GROUPS.map((g) => data.accounts?.[g.type] ?? 0));
  const ownerInitials = initials(data.owner || "You");
  return (
    <>
      <Box icon={<BookOpen size={15} className="text-primary" aria-hidden />} title="Your books">
        {ACCOUNT_GROUPS.map((group) => {
          const count = data.accounts?.[group.type] ?? 0;
          return (
            <div key={group.type} className="grid grid-cols-[90px_1fr_26px] items-center gap-2.5 py-1 text-[12px] text-on-surface">
              <span>{group.label}</span>
              <i className="block h-1.5 rounded-full bg-primary/70" style={{ width: `${Math.round((count / most) * 100)}%` }} />
              <span className="text-right tabular-nums text-on-surface-muted">{count}</span>
            </div>
          );
        })}
      </Box>
      <Box icon={<Users size={15} className="text-primary" aria-hidden />} title="Your team">
        <Member initials={ownerInitials} tone="mint" name={data.owner || "You"} role="Owner · you" />
        {data.invites.map((invite) => (
          <Member
            key={invite.email}
            initials={invite.email[0]!.toUpperCase()}
            tone={invite.role === "staff" ? "sky" : "periwinkle"}
            name={invite.email}
            role={invite.role === "staff" ? "Staff" : "Field"}
            invited
          />
        ))}
      </Box>
      <Box icon={<ListChecks size={15} className="text-primary" aria-hidden />} title="Set so far">
        <Recap label="Business" value={data.business.name?.trim() || "—"} />
        <Recap label="Money" value={[data.currency.code, data.taxCountryLabel].filter(Boolean).join(" · ")} />
        <Recap label="Documents" value={`First invoice ${data.invoiceNumber}`} />
      </Box>
      <p className="flex items-center gap-1.5 text-[12px] text-on-surface-muted">
        <Sparkles size={14} className="shrink-0 text-primary" aria-hidden />
        Spine posts to these accounts for you — no journal entries by hand.
      </p>
    </>
  );
}

const MEMBER_TONE = {
  mint: "bg-[var(--color-illustration-outfit-mint)]",
  sky: "bg-[var(--color-illustration-outfit-sky)]",
  periwinkle: "bg-[var(--color-illustration-outfit-periwinkle)]",
} as const;

function Member({ initials: letters, tone, name, role, invited = false }: { initials: string; tone: keyof typeof MEMBER_TONE; name: string; role: string; invited?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-border py-1.5 text-[12px] font-medium text-on-surface first-of-type:border-t-0">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[var(--color-illustration-ink)] ${MEMBER_TONE[tone]}`}>{letters}</span>
      <div className="min-w-0">
        <div className="truncate">{name}</div>
        <div className="text-[11px] font-normal text-on-surface-muted">{role}</div>
      </div>
      {invited && <span className="ml-auto inline-flex h-5 items-center rounded-full bg-due-soon-bg px-2 text-[11px] font-medium text-due-soon">Invited</span>}
    </div>
  );
}

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[12px] text-on-surface">
      <span className="w-[84px] shrink-0 font-medium text-on-surface-muted">{label}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}
