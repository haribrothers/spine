"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, Combobox } from "@spine/ui";
import { apiClient } from "../lib/api-client";
import { t as translate, useT } from "../lib/i18n";

import { SectionLink } from "./section-link";
export const ALL_JOBS = "__all__";

interface JobOption {
  id: string;
  name: string;
  number: string | null;
}

/** "JOB-001 · Marina office fit-out" */
function jobLabel(job: JobOption): string {
  return job.number ? `${job.number} · ${job.name}` : job.name;
}

/**
 * US-PUR-22 — the job filter on Vendor Bills and Expenses, kept in the URL
 * (`?jobId=`) so it can be shared or reloaded. Jobs come from `GET /jobs`,
 * which for Field users is only their assigned jobs.
 */
export function useJobFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") ?? ALL_JOBS;
  const [jobs, setJobs] = useState<JobOption[]>([]);

  useEffect(() => {
    apiClient
      .get<JobOption[]>("/jobs?picker=1")
      .then(setJobs)
      .catch(() => {});
  }, []);

  const setJobId = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === ALL_JOBS) params.delete("jobId");
      else params.set("jobId", next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const options = useMemo(() => [{ value: ALL_JOBS, label: translate("jobs.filter.allJobs") }, ...jobs.map((j) => ({ value: j.id, label: jobLabel(j) }))], [jobs]);
  const selected = jobs.find((j) => j.id === jobId);

  return { jobId, setJobId, options, selectedLabel: selected ? jobLabel(selected) : null, filtering: jobId !== ALL_JOBS };
}

export function JobFilter({ value, options, onValueChange }: { value: string; options: { value: string; label: string }[]; onValueChange: (value: string) => void }) {
  const t = useT();
  return <Combobox options={options} value={value} onValueChange={onValueChange} placeholder={t("jobs.filter.allJobs")} aria-label={t("jobs.filter.filterByJob")} className="w-60" />;
}

/** "Showing expenses on JOB-001 · Marina office fit-out. See vendor bills on this job · Open the job's costing" */
export function JobFilterNote({ kind, jobId, label, canViewCosting }: { kind: "expenses" | "vendor bills"; jobId: string; label: string; canViewCosting: boolean }) {
  const t = useT();
  const other = kind === "expenses" ? { href: `/vendor-bills?jobId=${jobId}`, text: t("jobs.filter.seeVendorBills") } : { href: `/expenses?jobId=${jobId}`, text: t("jobs.filter.seeExpenses") };
  return (
    <Alert variant="info">
      <AlertDescription>
        {kind === "expenses" ? t("jobs.filter.showingExpenses", { label }) : t("jobs.filter.showingVendorBills", { label })}{" "}
        <Link href={other.href} className="text-primary hover:underline">
          {other.text}
        </Link>
        {canViewCosting && (
          <>
            {" · "}
            <SectionLink href={`/jobs/${jobId}?tab=costing`} className="text-primary hover:underline">
              {t("jobs.filter.openCosting")}
            </SectionLink>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
