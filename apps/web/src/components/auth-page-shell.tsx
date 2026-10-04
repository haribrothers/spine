import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";

/** The signed-out page frame: logo, theme toggle, then one centred card. */
export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex w-full max-w-sm items-center justify-center">
        <Image src="/spine-logo-horizontal.png" alt="Spine" width={140} height={41} priority className="dark:hidden" />
        <Image src="/spine-logo-horizontal-light.png" alt="Spine" width={140} height={41} priority className="hidden dark:block" />
      </div>
      <ThemeToggle />
      {children}
    </main>
  );
}
