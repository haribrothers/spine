"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Spinner,
  useConfirm,
} from "@spine/ui";
import {
  DEMO_COUNTRY_LABELS,
  INDUSTRY_TEMPLATES,
  type DemoDataStatus,
} from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { DemoBusinessDialog } from "../../../components/demo-business-dialog";
import { useToast } from "../../../components/toast-host";

/**
 * Owner-only Settings › Data. "Load demo data" opens the country and
 * industry picker (US-ONB-18); once loaded, the pane names the demo.
 * "Delete all demo data" removes every row tagged `isDemo`, the journal
 * entries they posted and the demo number series (US-ONB-17, D-191); the
 * API picks the rows, never the client. A demo contact that one of the
 * person's own records uses is kept, and the pane says so. Deleting asks
 * first (D-218) and says what happened (D-223, US-SET-08).
 */
export function DataPane() {
  const [status, setStatus] = useState<DemoDataStatus | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keptContacts, setKeptContacts] = useState(0);
  const { confirm, dialog } = useConfirm();
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    apiClient.get<DemoDataStatus>("/demo-data/status").then((res) => {
      if (!cancelled) setStatus(res);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLoaded() {
    setKeptContacts(0);
    setStatus(await apiClient.get<DemoDataStatus>("/demo-data/status"));
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete all demo data?",
      description:
        "This permanently deletes every demo contact, item, quote, invoice, payment, bill, expense, job and meeting, and the entries they made in your books. Your own records stay. The demo people lose access. This can't be undone.",
      confirmLabel: "Delete demo data",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await apiClient.delete<{ kept?: { contacts: number } }>(
        "/demo-data",
      );
      const kept = result?.kept?.contacts ?? 0;
      setKeptContacts(kept);
      setStatus(await apiClient.get<DemoDataStatus>("/demo-data/status"));
      toast(
        "Demo data deleted",
        kept > 0
          ? `Your own records stay. ${keptContactsMessage(kept)}`
          : "Your own records stay.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The demo data wasn't deleted. Try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-on-surface">Demo data</h2>
        <p className="text-[13px] text-on-surface-muted">
          A sample business to explore Spine before you enter your own. Deleting
          it removes every demo record, its document numbers and its entries in
          your books.
        </p>
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {status.hasDemoData ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-surface p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-on-surface">
              Demo data is loaded
            </span>
            {status.loaded && (
              <span
                className="text-[13px] text-on-surface"
                data-testid="demo-loaded"
              >
                {`${status.loaded.businessName} · ${DEMO_COUNTRY_LABELS[status.loaded.country]} · ${INDUSTRY_TEMPLATES[status.loaded.industry].label}`}
              </span>
            )}
            <span className="text-[13px] text-on-surface-muted">
              Removing it only deletes demo records — your real data is never
              touched.
            </span>
          </div>
          <Button
            variant="danger"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Spinner size="sm" /> Deleting…
              </>
            ) : (
              "Delete all demo data"
            )}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface p-4">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-on-surface-muted">
              No demo data is currently loaded.
            </span>
            {keptContacts > 0 && (
              <span role="status" className="text-[13px] text-on-surface-muted">
                {keptContactsMessage(keptContacts)}
              </span>
            )}
          </div>
          <Button variant="secondary" onClick={() => setPickerOpen(true)}>
            Load demo data
          </Button>
        </div>
      )}

      {dialog}
      <DemoBusinessDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onLoaded={handleLoaded}
      />
    </div>
  );
}

/** "Kept 1 demo contact that your own records use." */
export function keptContactsMessage(n: number): string {
  return `Kept ${n} demo ${n === 1 ? "contact" : "contacts"} that your own records use.`;
}
