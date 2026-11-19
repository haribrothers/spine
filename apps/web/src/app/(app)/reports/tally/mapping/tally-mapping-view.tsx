"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, DataTable, ReportFilter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Spinner, type TableColumn } from "@spine/ui";
import { ReportToolbar } from "../../../../../components/report-toolbar";
import { FINANCIAL_STATEMENTS_NO_ACCESS, TALLY_GROUPS, type TallyGroup, type TallyMappingRow } from "@spine/shared";
import { apiClient } from "../../../../../lib/api-client";
import { useMyRole } from "../../../../../lib/role-context";
import { useToast } from "../../../../../components/toast-host";
import { ReportFootnote, useReport } from "../../report-kit";
import { t, useT } from "../../../../../lib/i18n";

const TYPE_LABELS: Record<TallyMappingRow["type"], string> = { asset: t("reports.tallyMapping.types.asset"), liability: t("reports.tallyMapping.types.liability"), equity: t("reports.tallyMapping.types.equity"), income: t("reports.tallyMapping.types.income"), expense: t("reports.tallyMapping.types.expense") };
type TypeFilter = "all" | TallyMappingRow["type"];

/**
 * US-RPT-39 (D-149) — each account with its Spine type and a Tally group
 * picker. Accounts start on the default for their type and code; an Owner
 * saves changes, which every later export uses.
 */
export function TallyMappingView() {
  const t = useT();
  const isOwner = useMyRole() === "owner";
  const { data, error, loading } = useReport<TallyMappingRow[]>("/exports/tally/mapping", FINANCIAL_STATEMENTS_NO_ACCESS);
  const [rows, setRows] = useState<TallyMappingRow[]>([]);
  const [changed, setChanged] = useState<Record<string, TallyGroup>>({});
  const [type, setType] = useState<TypeFilter>("all");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const showToast = useToast();

  useEffect(() => {
    if (data) setRows(data);
  }, [data]);

  const visible = useMemo(() => rows.filter((r) => type === "all" || r.type === type), [rows, type]);
  const dirty = Object.keys(changed).length;

  const choose = (row: TallyMappingRow, group: TallyGroup) => {
    setRows((current) => current.map((r) => (r.accountId === row.accountId ? { ...r, tallyGroup: group } : r)));
    setChanged((current) => ({ ...current, [row.accountId]: group }));
  };

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await apiClient.put<TallyMappingRow[]>("/exports/tally/mapping", { mappings: Object.entries(changed).map(([accountId, tallyGroup]) => ({ accountId, tallyGroup })) });
      setRows(saved);
      setChanged({});
      showToast(t("reports.tallyMapping.saved"), t("reports.tallyMapping.savedDescription"));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("reports.tallyMapping.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const groupPicker = (r: TallyMappingRow, width: string) => (
    <Select value={r.tallyGroup} onValueChange={(v) => choose(r, v as TallyGroup)} disabled={!isOwner}>
      <SelectTrigger className={width} aria-label={t("reports.tallyMapping.tallyGroupFor", { code: r.code, name: r.name })} data-testid={`tally-group-${r.code}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TALLY_GROUPS.map((g) => (
          <SelectItem key={g} value={g}>
            {g}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  // US-RPT-41: on a phone each account is a row — its name, then code and type — with its Tally group picker on the right.
  const columns: TableColumn<TallyMappingRow>[] = [
    { key: "code", header: t("reports.common.code"), phone: "subtitle", phoneRender: (r) => `${r.code} · ${TYPE_LABELS[r.type]}`, render: (r) => r.code, sortValue: (r) => r.code },
    { key: "name", header: t("reports.common.account"), phone: "title", render: (r) => r.name, sortValue: (r) => r.name },
    { key: "type", header: t("reports.tallyMapping.spineType"), phone: "hidden", render: (r) => TYPE_LABELS[r.type], sortValue: (r) => r.type },
    { key: "group", header: t("reports.tallyMapping.tallyGroup"), phone: "action", phoneRender: (r) => groupPicker(r, "w-40"), render: (r) => groupPicker(r, "w-56") },
  ];

  return (
    <>
      <ReportToolbar
        loading={loading}
        summary={type === "all" ? t("reports.tallyMapping.allAccountTypes") : TYPE_LABELS[type]}
        filters={
          <ReportFilter label={t("reports.tallyMapping.accountType")}>
            {(id) => (
              <Select value={type} onValueChange={(v) => setType(v as TypeFilter)}>
                <SelectTrigger className="w-48" aria-labelledby={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("reports.tallyMapping.allAccountTypes")}</SelectItem>
                  {(Object.keys(TYPE_LABELS) as TallyMappingRow["type"][]).map((ty) => (
                    <SelectItem key={ty} value={ty}>
                      {TYPE_LABELS[ty]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </ReportFilter>
        }
        actions={
          isOwner &&
          data && (
            <Button onClick={() => void save()} disabled={dirty === 0 || saving}>
              {saving && <Spinner size="sm" />}
              {t("reports.tallyMapping.save")}
            </Button>
          )
        }
      />

      {(error || saveError) && (
        <Alert variant="critical">
          <AlertDescription>{error ?? saveError}</AlertDescription>
        </Alert>
      )}
      {data && !isOwner && (
        <Alert>
          <AlertDescription>{t("reports.tallyMapping.ownerOnly")}</AlertDescription>
        </Alert>
      )}

      {data && (
        <div data-testid="tally-mapping">
          <DataTable columns={columns} data={visible} rowKey={(r) => r.accountId} searchPlaceholder={t("reports.tallyMapping.search")} searchKey={(r) => `${r.code} ${r.name}`} configurablePageSize pageSizeOptions={[10, 25, 50, 100]} />
        </div>
      )}
      <ReportFootnote>{t("reports.tallyMapping.footnote")}</ReportFootnote>
    </>
  );
}
