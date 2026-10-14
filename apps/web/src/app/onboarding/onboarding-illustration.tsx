import type { CSSProperties } from "react";
import { Caption, Figure, IllustrationPanel } from "../../components/auth-illustration";
import styles from "./onboarding-illustration.module.css";

type Delay = CSSProperties & { "--d"?: string };

function Line({ width, tone }: { width: string; tone?: "strong" | "active" }) {
  const cls = [styles.line, tone === "strong" ? styles.lineStrong : "", tone === "active" ? styles.lineActive : ""].filter(Boolean).join(" ");
  return <i className={cls} style={{ width }} />;
}

/** The dashboard drawn small: a sidebar, three tiles and a chart, all placeholder lines. */
function DashboardWindow({ style }: { style: Delay }) {
  return (
    <div className={styles.window} style={style}>
      <div className={styles.bar}>
        <i />
        <i />
        <i />
      </div>
      <div className={styles.body}>
        <div className={styles.side}>
          <Line width="80%" tone="active" />
          {["70%", "85%", "60%", "75%", "65%", "80%", "55%"].map((w, i) => (
            <Line key={i} width={w} />
          ))}
        </div>
        <div className={styles.main}>
          <div className={styles.kpis}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.kpi}>
                <Line width="60%" />
                <Line width="80%" tone="strong" />
                <i className={styles.trend} />
              </div>
            ))}
          </div>
          <div className={styles.chart}>
            {[40, 30, 55, 35, 62, 42, 70, 48, 85, 52].map((h, i) => (
              <i key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * US-ONB-22 (D-208) — beside the start screen: Spine's dashboard, a paid
 * invoice and the phone app drawn small, and two of the D-207 people.
 */
export function OnboardingStartIllustration() {
  return (
    <IllustrationPanel testId="onboarding-start-illustration">
      <Caption title="Everything in one place." body="Quotes, jobs, invoices and your books — on the web and on the phone." />
      <DashboardWindow style={{ left: "6%", top: "15%", width: "68%", height: "34%", "--d": "0.2s" }} />
      <div className={styles.invoice} style={{ left: "2%", top: "45%", width: "30%", "--d": "0.6s" } as Delay}>
        <div className={styles.invoiceHead}>
          <span className={styles.logo} />
          <span className={styles.paid}>Paid</span>
        </div>
        <Line width="70%" />
        <Line width="45%" />
        <Line width="90%" />
        <Line width="55%" tone="strong" />
      </div>
      <div className={styles.phone} style={{ right: "5%", top: "29%", width: "21%", height: "36%", "--d": "0.9s" } as Delay}>
        <div className={styles.screen}>
          {["", styles.dotPaid, styles.dotDue].map((tone, i) => (
            <div key={i} className={styles.row}>
              <span className={[styles.dot, tone].filter(Boolean).join(" ")} />
              <span className={styles.rowLines}>
                <Line width="80%" tone="strong" />
                <Line width="50%" />
              </span>
            </div>
          ))}
          <span className={styles.phoneButton} />
        </div>
      </div>
      <div className={styles.people}>
        <Figure who="trades" outfit="mint" delay="0.1s" height="min(34cqh, 44cqw)" />
        <Figure who="owner" outfit="sky" delay="0.25s" height="min(32cqh, 42cqw)" />
      </div>
    </IllustrationPanel>
  );
}

const CONFETTI: { left: string; top: string; w: number; h: number; color: string; turn: number }[] = [
  { left: "10%", top: "7%", w: 10, h: 16, color: "var(--color-brand-layer-top-from)", turn: 20 },
  { left: "88%", top: "6%", w: 8, h: 8, color: "var(--color-brand-deep)", turn: 0 },
  { left: "8%", top: "29%", w: 12, h: 6, color: "var(--color-brand-layer-mid-from)", turn: -30 },
  { left: "90%", top: "26%", w: 9, h: 15, color: "var(--color-brand-layer-mid-to)", turn: 40 },
  { left: "87%", top: "45%", w: 8, h: 8, color: "var(--color-brand-layer-top-to)", turn: 0 },
  { left: "13%", top: "46%", w: 7, h: 12, color: "var(--color-brand-layer-base-from)", turn: -15 },
  { left: "50%", top: "4%", w: 10, h: 10, color: "var(--color-brand-layer-top-from)", turn: 45 },
  { left: "35%", top: "48%", w: 12, h: 6, color: "var(--color-brand-deep)", turn: 15 },
  { left: "65%", top: "47%", w: 9, h: 9, color: "var(--color-brand-layer-mid-to)", turn: 0 },
  { left: "5%", top: "16%", w: 6, h: 12, color: "var(--color-brand-layer-top-to)", turn: 60 },
];

/** US-ONB-23 (D-208) — beside the finish screen: the dashboard is ready, the team below it and a little confetti. */
export function OnboardingFinishIllustration() {
  return (
    <IllustrationPanel testId="onboarding-finish-illustration">
      {CONFETTI.map((c, i) => (
        <i
          key={i}
          className={styles.confetti}
          style={{ left: c.left, top: c.top, width: c.w, height: c.h, background: c.color, rotate: `${c.turn}deg`, "--d": `${0.3 + i * 0.05}s` } as Delay}
        />
      ))}
      <DashboardWindow style={{ left: "14%", top: "9%", width: "72%", height: "34%", "--d": "0.1s" }} />
      <div className={`${styles.people} ${styles.team}`}>
        <Figure who="trades" outfit="mint" delay="0.2s" height="min(36cqh, 46cqw)" />
        <Figure who="owner" outfit="sky" delay="0.35s" height="min(34cqh, 44cqw)" />
        <Figure who="customer" outfit="periwinkle" delay="0.5s" height="min(34cqh, 44cqw)" />
      </div>
    </IllustrationPanel>
  );
}
