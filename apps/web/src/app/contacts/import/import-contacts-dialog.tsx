"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@spine/ui";
import { AlertTriangle, FileUp, Upload } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import type { Contact } from "../types";
import { buildImportRows } from "./build-rows";
import { IMPORT_FIELD_LABELS, IMPORT_FIELDS, REQUIRED_IMPORT_FIELDS, type ColumnMapping, type ImportRow, type ImportRowResult } from "./types";

type WizardStep = "upload" | "map" | "preview" | "importing" | "results";

/**
 * S-01.8 CSV import — a 3-step wizard (upload -> map columns -> preview &
 * confirm) rather than a fixed-header template, since real-world exports
 * from other CRMs/spreadsheets rarely match any one header convention.
 * Parsing and validation both happen client-side (papaparse); the API only
 * ever receives already-validated `CreateContactInput` rows via the
 * existing `POST /contacts/import`, which reuses `ContactsService.create()`
 * per row — no separate CSV-aware logic on the server.
 *
 * Duplicate rows (matched by email/phone against `existingContacts`, same
 * rule as a single manual create) are flagged but pre-included per PRD §9's
 * "warns ... but does not block" — the user can uncheck them individually.
 */
export function ImportContactsDialog({
  open,
  onOpenChange,
  existingContacts,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingContacts: Contact[];
  onImported: (createdCount: number) => void;
}) {
  const [step, setStep] = useState<WizardStep>("upload");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ImportRowResult[]>([]);

  function reset() {
    setStep("upload");
    setFileName("");
    setParseError(null);
    setHeaders([]);
    setParsedRows([]);
    setMapping({});
    setRows([]);
    setResults([]);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setParseError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setParseError(result.errors[0]!.message);
          return;
        }
        const cols = result.meta.fields ?? [];
        if (cols.length === 0) {
          setParseError("No columns found — the file may be empty or not a CSV.");
          return;
        }
        setHeaders(cols);
        setParsedRows(result.data);
        setMapping(autoMapColumns(cols));
        setStep("map");
      },
      error: (err) => setParseError(err.message),
    });
  }

  function handleMappingContinue() {
    setRows(buildImportRows(parsedRows, mapping, existingContacts));
    setStep("preview");
  }

  const includedCount = useMemo(() => rows.filter((r) => r.included).length, [rows]);
  const errorCount = useMemo(() => rows.filter((r) => r.errors.length > 0).length, [rows]);
  const duplicateCount = useMemo(() => rows.filter((r) => r.duplicateOf.length > 0).length, [rows]);
  const mappedRequiredFields = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);
  const missingRequiredFields = REQUIRED_IMPORT_FIELDS.filter((f) => !mappedRequiredFields.has(f));

  async function handleImport() {
    setStep("importing");
    const toImport = rows.filter((r) => r.included);
    try {
      const apiResults = await apiClient.post<{ index: number; contact?: Contact; error?: string }[]>("/contacts/import", {
        rows: toImport.map((r) => ({
          type: r.type,
          isCompany: r.isCompany,
          name: r.name,
          email: r.email,
          phone: r.phone,
          notes: r.notes,
          taxId: r.taxId,
          website: r.website,
        })),
      });
      const mapped: ImportRowResult[] = apiResults.map((res, i) => ({
        rowNumber: toImport[i]!.rowNumber,
        status: res.error ? "error" : "created",
        message: res.error,
        duplicateOf: res.contact?.duplicateWarning?.map((d) => d.name),
      }));
      setResults(mapped);
      setStep("results");
      const createdCount = mapped.filter((r) => r.status === "created").length;
      if (createdCount > 0) onImported(createdCount);
    } catch (err) {
      // A request-level failure (network drop, timeout) can't tell us
      // which rows, if any, the server actually committed before it
      // happened — importMany() processes sequentially and doesn't roll
      // back on a later row's failure. Rather than let the user blindly
      // retry and risk re-creating whatever DID land, re-fetch the org's
      // contacts and recompute duplicate flags before returning to
      // preview: anything that succeeded now shows up as a flagged
      // duplicate for the user to review/exclude, instead of silently
      // duplicating on retry.
      try {
        const refreshed = await apiClient.get<Contact[]>("/contacts?includeArchived=true");
        setRows(buildImportRows(parsedRows, mapping, refreshed));
      } catch {
        // Refresh itself failed — fall back to the original rows unchanged
        // rather than blocking the user from seeing any error state at all.
      }
      setParseError(
        err instanceof Error
          ? `${err.message} — some rows may have already been created. Review the list below before retrying.`
          : "Import failed — some rows may have already been created. Review the list below before retrying.",
      );
      setStep("preview");
    }
  }

  function toggleRowIncluded(rowNumber: number) {
    setRows((current) => current.map((r) => (r.rowNumber === rowNumber ? { ...r, included: !r.included } : r)));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Import contacts from CSV</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV exported from a spreadsheet or another CRM."}
            {step === "map" && "Match your file's columns to Spine's contact fields."}
            {step === "preview" && "Review each row before importing — uncheck any you want to skip."}
            {step === "importing" && "Importing…"}
            {step === "results" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 pb-5">
          {step === "upload" && (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border py-16 text-center transition-colors hover:border-primary hover:bg-surface-sunken">
              <FileUp size={32} className="text-on-surface-muted" />
              <div>
                <p className="text-[13px] font-medium text-on-surface">Click to choose a CSV file</p>
                <p className="text-[12px] text-on-surface-muted">or drag and drop</p>
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
          )}

          {parseError && (
            <Alert variant="critical" className="mt-4">
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {step === "map" && (
            <div className="flex flex-col gap-4">
              <p className="text-[13px] text-on-surface-muted">
                {fileName} — {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"} found.
              </p>
              <div className="flex flex-col gap-2">
                {headers.map((column) => (
                  <div key={column} className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-on-surface">{column}</p>
                      <p className="truncate text-[12px] text-on-surface-muted">e.g. {parsedRows[0]?.[column] || "—"}</p>
                    </div>
                    <Select
                      value={mapping[column] ?? "__skip__"}
                      onValueChange={(value) => setMapping((current) => ({ ...current, [column]: value === "__skip__" ? null : (value as ColumnMapping[string]) }))}
                    >
                      <SelectTrigger className="w-56 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">Don&apos;t import</SelectItem>
                        {IMPORT_FIELDS.map((field) => (
                          <SelectItem key={field} value={field}>
                            {IMPORT_FIELD_LABELS[field]}
                            {REQUIRED_IMPORT_FIELDS.includes(field) ? " *" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {missingRequiredFields.length > 0 && (
                <Alert variant="warning">
                  <AlertDescription>
                    Map a column to {missingRequiredFields.map((f) => IMPORT_FIELD_LABELS[f]).join(" and ")} to continue — every contact needs {missingRequiredFields.length > 1 ? "these" : "this"}.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === "preview" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{includedCount} to import</Badge>
                {errorCount > 0 && <Badge className="bg-overdue/10 text-overdue">{errorCount} with errors</Badge>}
                {duplicateCount > 0 && <Badge className="bg-due-soon/10 text-due-soon">{duplicateCount} possible duplicates</Badge>}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="sticky top-0 bg-surface-sunken">
                    <tr>
                      <th className="w-10 px-3 py-2"></th>
                      <th className="px-3 py-2 text-left font-medium text-on-surface-muted">Row</th>
                      <th className="px-3 py-2 text-left font-medium text-on-surface-muted">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-on-surface-muted">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-on-surface-muted">Email</th>
                      <th className="px-3 py-2 text-left font-medium text-on-surface-muted">Phone</th>
                      <th className="px-3 py-2 text-left font-medium text-on-surface-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowNumber} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <Checkbox checked={row.included} disabled={row.errors.length > 0} onCheckedChange={() => toggleRowIncluded(row.rowNumber)} />
                        </td>
                        <td className="px-3 py-2 text-on-surface-muted">{row.rowNumber}</td>
                        <td className="px-3 py-2 text-on-surface">{row.name || "—"}</td>
                        <td className="px-3 py-2 text-on-surface">{row.type ?? "—"}</td>
                        <td className="px-3 py-2 text-on-surface">{row.email ?? "—"}</td>
                        <td className="px-3 py-2 text-on-surface">{row.phone ?? "—"}</td>
                        <td className="px-3 py-2">
                          {row.errors.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-overdue">
                              <AlertTriangle size={12} />
                              {row.errors.join("; ")}
                            </span>
                          ) : row.duplicateOf.length > 0 ? (
                            <span className="text-due-soon">Possible duplicate of {row.duplicateOf.join(", ")}</span>
                          ) : (
                            <span className="text-on-surface-muted">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          )}

          {step === "results" && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-on-surface">
                {results.filter((r) => r.status === "created").length} contact{results.filter((r) => r.status === "created").length === 1 ? "" : "s"} created.
              </p>
              {results.some((r) => r.status === "created" && r.duplicateOf?.length) && (
                <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                  <p className="text-[13px] font-medium text-due-soon">Created, but possible duplicates — worth reviewing:</p>
                  {results
                    .filter((r) => r.status === "created" && r.duplicateOf?.length)
                    .map((r) => (
                      <p key={r.rowNumber} className="text-[12px] text-on-surface-muted">
                        Row {r.rowNumber}: matches {r.duplicateOf!.join(", ")}
                      </p>
                    ))}
                </div>
              )}
              {results.some((r) => r.status === "error") && (
                <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                  <p className="text-[13px] font-medium text-overdue">Rows that failed:</p>
                  {results
                    .filter((r) => r.status === "error")
                    .map((r) => (
                      <p key={r.rowNumber} className="text-[12px] text-on-surface-muted">
                        Row {r.rowNumber}: {r.message}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {(step === "map" || step === "preview" || step === "results") && (
          <DialogFooter className="px-5 pb-5">
            {step === "map" && (
              <>
                <Button variant="secondary" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button onClick={handleMappingContinue} disabled={missingRequiredFields.length > 0}>
                  Continue
                </Button>
              </>
            )}
            {step === "preview" && (
              <>
                <Button variant="secondary" onClick={() => setStep("map")}>
                  Back
                </Button>
                <Button onClick={handleImport} disabled={includedCount === 0}>
                  <Upload size={14} />
                  Import {includedCount} contact{includedCount === 1 ? "" : "s"}
                </Button>
              </>
            )}
            {step === "results" && <Button onClick={() => handleOpenChange(false)}>Done</Button>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Best-effort auto-mapping by loose header-name matching (case/space/
 * punctuation-insensitive), so a well-labeled CSV (e.g. "Full Name",
 * "Email Address") doesn't force the user to map every column by hand —
 * always overridable in the mapping step, never silently trusted for
 * required fields without the user seeing the mapping UI first.
 */
function autoMapColumns(columns: string[]): ColumnMapping {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const candidates: Record<string, string[]> = {
    name: ["name", "fullname", "contactname", "company", "companyname"],
    type: ["type", "contacttype"],
    // Deliberately no bare "company" alias — a column literally named
    // "Company" is far more likely to hold the company's name (text) than
    // an is-this-a-company boolean, and a wrong auto-map here would
    // silently discard the whole column's text content (see build-rows.ts:
    // isCompany only reads TRUE_VALUES, anything else becomes false).
    // "Company" now matches `name` instead, which is the safer default for
    // an org whose CSV has no separate contact-name column.
    isCompany: ["iscompany"],
    email: ["email", "emailaddress"],
    phone: ["phone", "phonenumber", "mobile", "tel"],
    notes: ["notes", "note", "comment", "comments"],
    taxId: ["taxid", "vatid", "vatnumber", "taxnumber"],
    website: ["website", "url", "site"],
  };
  const mapping: ColumnMapping = {};
  for (const column of columns) {
    const normalized = normalize(column);
    const match = Object.entries(candidates).find(([, aliases]) => aliases.includes(normalized));
    mapping[column] = (match?.[0] as ColumnMapping[string]) ?? null;
  }
  return mapping;
}
