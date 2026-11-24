import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@spine/ui";
import { ThemeProvider } from "@/components/theme-provider";
import { DocsShell } from "@/components/docs-shell";

export const metadata: Metadata = {
  title: "Spine Design System",
  description: "Design tokens, foundations, and the @spine/ui component catalogue.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            <DocsShell>{children}</DocsShell>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
