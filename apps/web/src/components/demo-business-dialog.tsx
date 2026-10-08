"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import {
  DEMO_COUNTRIES,
  DEMO_COUNTRY_LABELS,
  DEMO_INDUSTRIES,
  INDUSTRY_TEMPLATES,
  demoBusinessName,
  demoCountryFixedNote,
  guessDemoCountry,
  type DemoCountry,
  type DemoDataStatus,
  type DemoIndustry,
} from "@spine/shared";
import { apiClient } from "../lib/api-client";

/** The browser's time zone, for the first guess at a country (US-ONB-18). */
function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/**
 * US-ONB-18 (D-192) — "Explore a demo business": pick a country and an
 * industry and load a sample business with six months of history. The
 * welcome screen and Settings › Data both open it. Before the business has
 * records of its own, the choice also sets its country, currency, tax and
 * template; after, the country is the business's own and only the
 * industry can change.
 */
export function DemoBusinessDialog({ open, onOpenChange, onLoaded }: { open: boolean; onOpenChange: (open: boolean) => void; onLoaded: () => void | Promise<void> }) {
  const [status, setStatus] = useState<DemoDataStatus | null>(null);
  const [country, setCountry] = useState<DemoCountry>("US");
  const [industry, setIndustry] = useState<DemoIndustry>("construction");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setError(null);
    apiClient
      .get<DemoDataStatus>("/demo-data/status")
      .then((s) => {
        setStatus(s);
        setCountry(s.country ?? guessDemoCountry(browserTimeZone()));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "The demo choices didn't load. Try again."));
  }, [open]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post("/demo-data/seed", { country, industry });
      await onLoaded();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The demo business didn't load. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const locked = status?.countryLocked ?? false;

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Explore a demo business</DialogTitle>
          <DialogDescription>
            A sample business with six months of quotes, invoices, payments, bills and expenses. Delete it any time in Settings › Data — your own
            records stay.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!status && !error ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : status ? (
            <>
              <FormField
                label="Country"
                helperText={locked && status.country ? demoCountryFixedNote(status.country) : locked ? demoCountryFixedNote("US") : "Your tax country, currency and industry template change to the demo's. You can change them back in Settings."}
              >
                {(field) => (
                  <Select value={country} onValueChange={(v) => setCountry(v as DemoCountry)} disabled={locked}>
                    <SelectTrigger {...field}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {DEMO_COUNTRY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField label="Industry" helperText={`You'll see ${demoBusinessName(country, industry)}.`}>
                {(field) => (
                  <Select value={industry} onValueChange={(v) => setIndustry(v as DemoIndustry)}>
                    <SelectTrigger {...field}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_INDUSTRIES.map((i) => (
                        <SelectItem key={i} value={i}>
                          {INDUSTRY_TEMPLATES[i].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void load()} disabled={!status || loading}>
            {loading ? (
              <>
                <Spinner size="sm" /> Loading…
              </>
            ) : (
              "Load demo business"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
