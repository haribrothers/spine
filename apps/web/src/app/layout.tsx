import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { RouteLoader } from "../components/route-loader";
import { ThemeProvider } from "../components/theme-provider";

export const metadata: Metadata = {
  title: "Spine",
  description: "Self-hosted business management for service and project businesses.",
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
          <Suspense fallback={null}>
            <RouteLoader />
          </Suspense>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
