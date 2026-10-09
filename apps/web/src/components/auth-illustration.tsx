import type { CSSProperties, ReactNode } from "react";
import { Calendar, CircleCheck, FileCheck, FileText, HardHat, Receipt } from "lucide-react";
import styles from "./auth-illustration.module.css";

export type AuthScene = "welcome" | "login";

/** Animation timing per card or person, as on the canvas "02 Welcome, login and sign-up". */
type Timing = CSSProperties & { "--d"?: string; "--fd"?: string };

/** The people in public/illustrations/people.svg (Open Peeps, CC0), with each one's drawn proportions. */
const PEOPLE = {
  trades: "1340 / 2658",
  owner: "1111 / 2911",
  customer: "1115 / 2971",
  morning: "824 / 1135",
} as const;
type Person = keyof typeof PEOPLE;
type Outfit = "mint" | "sky" | "periwinkle";

function Figure({ who, outfit, delay, className }: { who: Person; outfit: Outfit; delay: string; className?: string }) {
  return (
    <div className={[styles.person, styles[outfit], className].filter(Boolean).join(" ")} style={{ "--d": delay } as Timing}>
      <span className={styles.halo} />
      <svg className={styles.figure} style={{ aspectRatio: PEOPLE[who] }}>
        <use href={`/illustrations/people.svg#${who}`} />
      </svg>
    </div>
  );
}

function Card({ style, className, children }: { style: Timing; className?: string; children: ReactNode }) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(" ")} style={style}>
      {children}
    </div>
  );
}

/** Placeholder lines: the cards show what happens, never names or amounts. */
function Lines({ widths, strong = false }: { widths: string[]; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
      {widths.map((w, i) => (
        <i key={i} className={`block h-2 rounded-full ${strong && i === 0 ? "bg-border-strong" : "bg-border"}`} style={{ width: w }} />
      ))}
    </div>
  );
}

function Icon({ tone, children }: { tone: "info" | "paid" | "due"; children: ReactNode }) {
  const cls = { info: "bg-info-bg text-primary", paid: "bg-paid-bg text-paid", due: "bg-due-soon-bg text-due-soon" }[tone];
  return <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cls}`}>{children}</span>;
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

const ICON = { size: 17, "aria-hidden": true } as const;

function DocCard({ style, icon, tone, status }: { style: Timing; icon: ReactNode; tone: "info" | "due"; status: ReactNode }) {
  return (
    <Card style={style}>
      <div className="flex items-center gap-2">
        <Icon tone={tone}>{icon}</Icon>
        {status}
      </div>
      <div className="mt-3">
        <Lines widths={["78%", "46%"]} />
      </div>
      <i className="mt-3 block h-3 w-[54%] rounded-full bg-border-strong" />
    </Card>
  );
}

function WelcomeScene() {
  return (
    <>
      <Caption title="From quote to paid, in one place." body="Send a quote, win the job, invoice it and get paid — Spine keeps the books as you go." />
      <DocCard
        style={{ left: "5%", top: "20%", "--d": "0.9s", "--fd": "2.6s" }}
        icon={<FileText {...ICON} />}
        tone="info"
        status={<Swap at="1.6s" from={<Chip tone="info">Sent</Chip>} to={<Chip tone="paid">Accepted</Chip>} />}
      />
      <DocCard
        style={{ right: "5%", top: "27%", "--d": "1.3s", "--fd": "3s" }}
        icon={<Receipt {...ICON} />}
        tone="due"
        status={<Swap at="2.4s" from={<Chip tone="due">Due</Chip>} to={<Chip tone="paid">Paid</Chip>} />}
      />
      <Card className={styles.toast} style={{ left: "28%", top: "43%", "--d": "2.6s", "--fd": "3.4s" }}>
        <Icon tone="paid">
          <CircleCheck {...ICON} />
        </Icon>
        <Lines widths={["84%", "52%"]} strong />
        <Chip tone="paid">Paid</Chip>
      </Card>
      <div className={styles.team}>
        <Figure who="trades" outfit="mint" delay="0.1s" />
        <Figure who="owner" outfit="sky" delay="0.25s" />
        <Figure who="customer" outfit="periwinkle" delay="0.4s" />
      </div>
    </>
  );
}

function TodayRow({ icon, tone }: { icon: ReactNode; tone: "info" | "due" }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-border py-2 first:border-t-0">
      <Icon tone={tone}>{icon}</Icon>
      <Lines widths={["70%", "42%"]} strong />
      <i className="block h-2 w-[34px] shrink-0 rounded-full bg-border" />
    </div>
  );
}

function LoginScene() {
  return (
    <>
      <Caption title="Welcome back." body="Today’s jobs, quotes and payments are where you left them." />
      <Card className={styles.today} style={{ left: "5%", top: "20%", "--d": "0.5s", "--fd": "2.4s" }}>
        <div className="mb-1.5 mt-0.5">
          <Lines widths={["36%", "62%"]} />
        </div>
        <TodayRow icon={<HardHat {...ICON} />} tone="info" />
        <TodayRow icon={<HardHat {...ICON} />} tone="info" />
        <TodayRow icon={<Calendar {...ICON} />} tone="due" />
      </Card>
      <Card className={styles.toast} style={{ left: "5%", top: "54%", "--d": "1s", "--fd": "3.2s" }}>
        <Icon tone="paid">
          <FileCheck {...ICON} />
        </Icon>
        <Lines widths={["84%", "52%"]} strong />
        <Chip tone="paid">Accepted</Chip>
      </Card>
      <Figure who="morning" outfit="sky" delay="0.1s" className={styles.solo} />
    </>
  );
}

function Caption({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.caption}>
      <div className="text-[20px] font-semibold leading-snug tracking-tight text-on-surface">{title}</div>
      <div className="mt-1 max-w-[420px] text-[13px] leading-relaxed text-on-surface-muted">{body}</div>
    </div>
  );
}

/**
 * US-AUTH-13, US-AUTH-14 (D-207) — the illustration beside every signed-out
 * form: people (Open Peeps, CC0) in the illustration tokens' soft outfits,
 * and Spine's own cards with placeholder lines — no names or amounts, never
 * the install's data (D-084). "welcome" is the team and the quote → paid
 * story; "login" is one person and a calmer morning. Hidden from screen
 * readers; still unless the person allows motion.
 */
export function AuthIllustration({ scene }: { scene: AuthScene }) {
  return (
    <div className={`${styles.panel} h-full w-full`} aria-hidden data-testid={`auth-illustration-${scene}`}>
      <div className={styles.ground} />
      <div className={styles.stage}>{scene === "welcome" ? <WelcomeScene /> : <LoginScene />}</div>
    </div>
  );
}
