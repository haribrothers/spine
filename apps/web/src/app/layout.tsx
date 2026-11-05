import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { TooltipProvider } from "@spine/ui";
import "./globals.css";
import { RouteLoader } from "../components/route-loader";
import { ThemeProvider } from "../components/theme-provider";
import { t } from "../lib/i18n";

export const metadata: Metadata = {
  title: "Spine",
  description: t("common.app.description"),
};

/** US-SET-26 — the browser's bar takes the page colour, light or dark (tokens.json background). */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F6F3" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {/* US-OPS-36 (D-210) — one tooltip provider for the whole app. */}
          <TooltipProvider delayDuration={300}>
            <Suspense fallback={null}>
              <RouteLoader />
            </Suspense>
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
