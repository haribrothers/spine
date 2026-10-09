import type { CSSProperties, ReactNode } from "react";
import { Calendar, CircleCheck, FileCheck, FileText, HardHat, Receipt } from "lucide-react";
import { SpineLogo } from "@spine/ui";
import styles from "./auth-illustration.module.css";

export type AuthScene = "welcome" | "login";

/** Animation timing and placement per card, as on the canvas "02 Welcome, login and sign-up". */
type CardStyle = CSSProperties & { "--d"?: string; "--fd"?: string };

function Card({ style, className, children }: { style: CardStyle; className?: string; children: ReactNode }) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(" ")} style={style}>
      {children}
    </div>
  );
}

function Kicker({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return <div className="flex items-center gap-1.5 text-[11px] font-medium text-on-surface-muted">{icon}{children}</div>;
}

function Chip({ tone, children }: { tone: "info" | "paid" | "due"; children: string }) {
  const cls = { info: "bg-info-bg text-primary", paid: "bg-paid-bg text-paid", due: "bg-due-soon-bg text-due-soon" }[tone];
  return <span className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium ${cls}`}>{children}</span>;
}

/** A status that changes as the story plays: the first fades out as the second fades in. */
function Swap({ at, from, to }: { at: string; from: ReactNode; to: ReactNode }) {
  return (
    <span className={styles.swap} style={{ "--sd": at } as CSSProperties}>
      {from}
      {to}
    </span>
  );
}

const ICON = { size: 14, "aria-hidden": true } as const;

function WelcomeScene() {
  return (
    <>
      <Card style={{ left: "6%", top: "8%", width: 240, "--d": "0.2s", "--fd": "2.2s" }}>
        <Kicker icon={<FileText {...ICON} />}>
          QUO-0004 · Quote
          <Swap at="0.9s" from={<Chip tone="info">Sent</Chip>} to={<Chip tone="paid">Accepted</Chip>} />
        </Kicker>
        <div className="mt-1 text-[14px] font-semibold text-on-surface">Harborview Construction</div>
        <div className="mt-1.5 text-[18px] font-semibold tabular-nums text-on-surface">$12,800.00</div>
      </Card>
      <Card style={{ right: "5%", top: "20%", width: 236, "--d": "0.7s", "--fd": "3s" }}>
        <Kicker icon={<HardHat {...ICON} />}>JOB-012 · Job</Kicker>
        <div className="mt-1 text-[14px] font-semibold text-on-surface">Deck &amp; pergola</div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
          <div className="h-full w-3/5 rounded-full bg-paid" />
        </div>
        <div className="mt-1.5 text-[11px] font-medium text-on-surface-muted">3 of 5 milestones</div>
      </Card>
      <Card style={{ left: "6%", top: "57%", width: 246, "--d": "1.2s", "--fd": "2.6s" }}>
        <Kicker icon={<Receipt {...ICON} />}>
          INV-0018 · Invoice
          <Swap at="2s" from={<Chip tone="due">Due 30 Oct</Chip>} to={<Chip tone="paid">Paid</Chip>} />
        </Kicker>
        <div className="mt-1 text-[14px] font-semibold text-on-surface">Harborview Construction</div>
        <div className="mt-1.5 text-[18px] font-semibold tabular-nums text-on-surface">$12,800.00</div>
      </Card>
      <Card className="flex items-center gap-2.5" style={{ right: "6%", top: "68%", width: 256, "--d": "1.8s", "--fd": "3.4s" }}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paid-bg text-paid">
          <CircleCheck size={17} aria-hidden />
        </span>
        <div>
          <div className="text-[14px] font-semibold text-on-surface">Payment received</div>
          <div className="text-[11px] font-medium text-on-surface-muted">$12,800.00 · Bank transfer</div>
        </div>
      </Card>
      <Caption title="From quote to paid, in one place." body="Send a quote, win the job, invoice it and get paid — Spine keeps the books as you go." />
    </>
  );
}

function TodayRow({ icon, tone, title, place, time }: { icon: ReactNode; tone: "info" | "due"; title: string; place: string; time: string }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-border py-2 first:border-t-0">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone === "info" ? "bg-info-bg text-primary" : "bg-due-soon-bg text-due-soon"}`}>{icon}</span>
      <div className="text-[13px] font-medium text-on-surface">
        {title}
        <div className="text-[11px] font-normal text-on-surface-muted">{place}</div>
      </div>
      <span className="ml-auto text-[12px] font-medium text-on-surface-muted">{time}</span>
    </div>
  );
}

function LoginScene() {
  return (
    <>
      <Card style={{ left: "6%", top: "9%", width: 300, "--d": "0.2s", "--fd": "2.4s" }}>
        <Kicker>Today · Fri 9 Oct</Kicker>
        <div className="mt-1 text-[14px] font-semibold text-on-surface">Good morning, Alex</div>
        <div className="mt-2">
          <TodayRow icon={<HardHat size={17} aria-hidden />} tone="info" title="Marina office fit-out" place="14 Harbour St" time="8:00" />
          <TodayRow icon={<HardHat size={17} aria-hidden />} tone="info" title="Townhomes, phase 2" place="220 Ridge Rd" time="11:30" />
          <TodayRow icon={<Calendar size={17} aria-hidden />} tone="due" title="Site visit, Clinic" place="Meeting" time="2:00" />
        </div>
      </Card>
      <Card className="flex items-center gap-2.5" style={{ right: "5%", top: "56%", width: 268, "--d": "0.8s", "--fd": "3.2s" }}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paid-bg text-paid">
          <FileCheck size={17} aria-hidden />
        </span>
        <div>
          <div className="text-[14px] font-semibold text-on-surface">Bluewater accepted QUO-0006</div>
          <div className="text-[11px] font-medium text-on-surface-muted">$12,800.00 · just now</div>
        </div>
      </Card>
      <Card style={{ left: "10%", top: "70%", width: 236, "--d": "1.2s", "--fd": "2.8s" }}>
        <Kicker icon={<Receipt {...ICON} />}>
          INV-0017 · Invoice
          <span className="ml-auto">
            <Chip tone="paid">Paid</Chip>
          </span>
        </Kicker>
        <div className="mt-1 text-[14px] font-semibold text-on-surface">Maple Ridge Developments</div>
        <div className="mt-1.5 text-[18px] font-semibold tabular-nums text-on-surface">$4,542.50</div>
      </Card>
      <Caption title="Welcome back." body="Today’s jobs, quotes and payments are where you left them." />
    </>
  );
}

function Caption({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.caption}>
      <div className="text-[18px] font-semibold leading-snug text-on-surface">{title}</div>
      <div className="mt-1 text-[13px] leading-relaxed text-on-surface-muted">{body}</div>
    </div>
  );
}

/**
 * US-AUTH-13, US-AUTH-14 (D-207) — the illustration beside every signed-out
 * form: made-up work drawn with Spine's own card styles (never the install's
 * data, D-084), around the Spine mark and its orbits. "welcome" tells the
 * quote → job → invoice → paid story; "login" is a calmer day. Hidden from
 * screen readers; still unless the person allows motion.
 */
export function AuthIllustration({ scene }: { scene: AuthScene }) {
  return (
    <div className={`${styles.panel} h-full w-full`} aria-hidden data-testid={`auth-illustration-${scene}`}>
      <div className={styles.glow} />
      <svg className={styles.orbit} viewBox="0 0 560 300">
        <ellipse cx="280" cy="150" rx="272" ry="130" />
        <ellipse cx="280" cy="150" rx="190" ry="88" />
      </svg>
      <div className={styles.mark}>
        <SpineLogo variant="mark" size={76} decorative />
      </div>
      {scene === "welcome" ? <WelcomeScene /> : <LoginScene />}
    </div>
  );
}
