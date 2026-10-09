import { SpineLogo } from "@spine/ui";
import { ThemeToggle } from "./theme-toggle";
import { AuthIllustration, type AuthScene } from "./auth-illustration";

/**
 * US-AUTH-13, US-AUTH-14 (D-207) — the frame every signed-out page uses:
 * the logo and theme toggle on top, the page's own content centred, and the
 * illustration beside it from 1024 px up (below that, the content alone).
 */
export function AuthFrame({ scene = "login", children }: { scene?: AuthScene; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_1.12fr]">
      <main className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between">
          <SpineLogo variant="horizontal" size={96} />
          <ThemeToggle placement="inline" />
        </div>
        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-center text-[12px] text-on-surface-muted">Spine · self-hosted business management</p>
      </main>
      <div className="hidden py-4 pr-4 lg:block">
        <AuthIllustration scene={scene} />
      </div>
    </div>
  );
}

/** The heading and line under it that open every signed-out form. */
export function AuthHeading({ title, children, large = false }: { title: string; children?: React.ReactNode; large?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h1 className={`${large ? "text-[32px]" : "text-[26px]"} font-bold leading-tight tracking-tight text-on-surface`}>{title}</h1>
      {children ? <p className="text-[15px] leading-relaxed text-on-surface-muted">{children}</p> : null}
    </div>
  );
}
