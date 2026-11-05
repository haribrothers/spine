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
import { useT } from "../lib/i18n";

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
 * industry can change. When it loaded without something (its photos, if
 * file storage didn't take them — US-ONB-09), it says so before closing.
 */
export function DemoBusinessDialog({
  open,
  onOpenChange,
  onLoaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoaded: () => void | Promise<void>;
}) {
  const t = useT();
  const [status, setStatus] = useState<DemoDataStatus | null>(null);
  const [country, setCountry] = useState<DemoCountry>("US");
  const [industry, setIndustry] = useState<DemoIndustry>("construction");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setError(null);
    setNotes([]);
    apiClient
      .get<DemoDataStatus>("/demo-data/status")
      .then((s) => {
        setStatus(s);
        setCountry(s.country ?? guessDemoCountry(browserTimeZone()));
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : t("common.demoBusiness.statusFailed"),
        ),
      );
  }, [open, t]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.post<{ notes?: string[] }>(
        "/demo-data/seed",
        { country, industry },
      );
      if (result?.notes?.length) {
        setNotes(result.notes);
        return;
      }
      await onLoaded();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("common.demoBusiness.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  /** After a load with notes: the business is loaded, so closing goes on as a load does. */
  async function finish() {
    setNotes([]);
    await onLoaded();
    onOpenChange(false);
  }

  const locked = status?.countryLocked ?? false;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) =>
        !loading && (notes.length && !next ? void finish() : onOpenChange(next))
      }
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("common.demoBusiness.title")}</DialogTitle>
          <DialogDescription>
            {t("common.demoBusiness.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notes.length > 0 ? (
            <Alert variant="warning">
              <AlertDescription>
                {t("common.demoBusiness.loaded", { name: demoBusinessName(country, industry) })}
                {notes.join(" ")}
              </AlertDescription>
            </Alert>
          ) : !status && !error ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : status ? (
            <>
              <FormField
                label={t("common.demoBusiness.country")}
                helperText={
                  locked && status.country
                    ? demoCountryFixedNote(status.country)
                    : locked
                      ? demoCountryFixedNote("US")
                      : t("common.demoBusiness.countryHint")
                }
              >
                {(field) => (
                  <Select
                    value={country}
                    onValueChange={(v) => setCountry(v as DemoCountry)}
                    disabled={locked}
                  >
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
              <FormField
                label={t("common.demoBusiness.industry")}
                helperText={t("common.demoBusiness.youllSee", { name: demoBusinessName(country, industry) })}
              >
                {(field) => (
                  <Select
                    value={industry}
                    onValueChange={(v) => setIndustry(v as DemoIndustry)}
                  >
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
          {notes.length > 0 ? (
            <Button onClick={() => void finish()}>{t("common.demoBusiness.continue")}</Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button onClick={() => void load()} disabled={!status || loading}>
                {loading ? (
                  <>
                    <Spinner size="sm" /> {t("common.demoBusiness.loading")}
                  </>
                ) : (
                  t("common.demoBusiness.load")
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
