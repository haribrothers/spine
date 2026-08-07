import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { RouteLoader } from "../components/route-loader";
import { ThemeProvider } from "../components/theme-provider";

export const metadata: Metadata = {
  title: "Spine",
  description: "Self-hosted business management for service and project businesses.",
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
