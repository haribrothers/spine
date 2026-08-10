"use client";

import { useMemo } from "react";
import type { Job } from "./types";

/** Real counts derived client-side from the already-fetched job list, per this codebase's established rule against fabricated stat-card numbers (see invoices/use-invoice-stats.ts's own comment). */
export function useJobStats(jobs: Job[] | null) {
  return useMemo(() => {
    if (!jobs) {
      return { total: null, active: null, onHold: null, completed: null };
    }
    return {
      total: jobs.length,
      active: jobs.filter((j) => j.status === "active").length,
      onHold: jobs.filter((j) => j.status === "on_hold").length,
      completed: jobs.filter((j) => j.status === "completed").length,
    };
  }, [jobs]);
}
