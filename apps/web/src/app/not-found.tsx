import { NotFoundView } from "../components/not-found-view";

/** US-OPS-11 — a missing page outside the app shell (the shell's own is `(app)/not-found.tsx`). */
export default function RootNotFound() {
  return (
    <main className="min-h-screen bg-background px-4">
      <NotFoundView />
    </main>
  );
}
