"use client";

import "./globals.css";
import { ServerErrorView } from "../components/server-error-view";

/** US-OPS-13 — the root layout itself failed, so this page brings its own <html>. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body>
        <ServerErrorView error={error} />
      </body>
    </html>
  );
}
