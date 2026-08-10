"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Combobox, EmptyState, MultiSelect, StatCard } from "@spine/ui";
import { HardHat } from "lucide-react";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import { JobsSkeleton } from "./jobs-skeleton";
import { JobsTable } from "./jobs-table";
import { JOB_STATUS_LABELS, type ContactOption, type Job } from "./types";
import { useJobStats } from "./use-job-stats";

const STATUS_OPTIONS = Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label }));

const ALL_CONTACTS = "__all__";

/** The Jobs list page's client-side body — a stat-card row, a status filter, a contact filter, and one table, mirroring invoices/invoices-explorer.tsx's exact structure. */
export function JobsExplorer() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [contactFilter, setContactFilter] = useState<string>(ALL_CONTACTS);
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  const stats = useJobStats(jobs);

  const loadJobs = useCallback(() => {
    const query = contactFilter !== ALL_CONTACTS ? `?contactId=${contactFilter}` : "";
    apiClient
      .get<Job[]>(`/jobs${query}`)
      .then(setJobs)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load jobs."));
  }, [contactFilter]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    apiClient
      .get<ContactOption[]>("/contacts")
      .then(setContacts)
      .catch(() => {});
  }, []);

  const contactOptions = useMemo(
    () => [
      { value: ALL_CONTACTS, label: "All contacts" },
      ...contacts.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name })),
    ],
    [contacts],
  );

  const filteredJobs = useMemo(() => {
    if (!jobs) return null;
    if (!statusFilter.length) return jobs;
    return jobs.filter((job) => statusFilter.includes(job.status));
  }, [jobs, statusFilter]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total jobs" value={stats.total === null ? "—" : String(stats.total)} />
        <StatCard label="Active" value={stats.active === null ? "—" : String(stats.active)} />
        <StatCard label="On hold" value={stats.onHold === null ? "—" : String(stats.onHold)} />
        <StatCard label="Completed" value={stats.completed === null ? "—" : String(stats.completed)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect
            options={STATUS_OPTIONS}
            value={statusFilter}
            onValueChange={setStatusFilter}
            placeholder="Status"
            className="w-40"
          />
          <Combobox
            options={contactOptions}
            value={contactFilter}
            onValueChange={setContactFilter}
            placeholder="All contacts"
            className="w-48"
          />
        </div>
      </div>

      {!filteredJobs ? (
        <JobsSkeleton />
      ) : filteredJobs.length === 0 ? (
        <div className="rounded-lg border border-border">
          {statusFilter.length || contactFilter !== ALL_CONTACTS ? (
            <EmptyState
              icon={<HardHat />}
              title="No jobs match these filters"
              description="Try adjusting or clearing the filters above."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStatusFilter([]);
                    setContactFilter(ALL_CONTACTS);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<HardHat />}
              title="No jobs yet"
              description="Jobs are created from an accepted quote — open a quote and use Convert to job, or send one first."
              action={
                <Button asChild variant="secondary">
                  <Link href="/quotes">Go to quotes</Link>
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <JobsTable jobs={filteredJobs} />
      )}
    </div>
  );
}
