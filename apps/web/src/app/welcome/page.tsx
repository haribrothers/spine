import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@spine/ui";
import { AuthFrame, AuthHeading } from "../../components/auth-frame";

const NEXT_STEPS = ["Create your account", "Set up your business in a few minutes", "Invite your team"];

/**
 * US-AUTH-13 (D-207) — where a new install opens (the middleware sends `/`
 * and `/login` here while there are no accounts, and away once there are):
 * what Spine is, what happens next, and "Create your account".
 */
export default function WelcomePage() {
  return (
    <AuthFrame scene="welcome">
      <AuthHeading title="Run your business on Spine" large>
        Quotes, jobs, invoices and your books in one place — on your own server.
      </AuthHeading>
      <ol className="mt-7 flex flex-col gap-3.5">
        {NEXT_STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-3 text-[14px] font-medium text-on-surface">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-info-bg text-[12px] font-semibold text-primary">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <Button asChild size="touch" className="mt-7 w-full">
        <Link href="/signup">
          Create your account
          <ArrowRight size={16} aria-hidden />
        </Link>
      </Button>
      <p className="mt-4 flex items-center gap-2 text-[13px] text-on-surface-muted">
        <ShieldCheck size={16} className="text-paid" aria-hidden />
        Everything you enter stays on this server.
      </p>
    </AuthFrame>
  );
}
