import { ThemeToggle } from "./theme-toggle";
import { SpineLogo } from "@spine/ui";

/** The signed-out page frame: logo, theme toggle, then one centred card. */
export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex w-full max-w-sm items-center justify-center">
        <SpineLogo variant="horizontal" size={140} />
      </div>
      <ThemeToggle />
      {children}
    </main>
  );
}
