"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, FormField, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@spine/ui";
import {
  GST_STATES,
  POS_OTHER_COUNTRIES,
  placeOfSupplyFor,
  placeOfSupplyLabel,
  supplyTypeFor,
  switchLineTaxes,
  type GstTreatment,
  type ItemTaxes,
  type PlaceOfSupplySource,
  type SupplyType,
  type TaxChoice,
  type TaxProfile,
} from "@spine/shared";
import { apiClient } from "../lib/api-client";
import { t as translate, useT } from "../lib/i18n";

interface ContactForPlaceOfSupply {
  gstTreatment: GstTreatment | null;
  stateCode: string | null;
  addresses?: { type: string; stateCode: string | null; isPrimary: boolean }[];
}

type SwitchableLine = TaxChoice & { key: string; type: string; catalogItemId: string | null };

const SOURCE_LABELS: Record<PlaceOfSupplySource, string> = {
  site: translate("catalog.placeOfSupply.sourceSite"),
  shipping: translate("catalog.placeOfSupply.sourceShipping"),
  billing: translate("catalog.placeOfSupply.sourceBilling"),
  contact: translate("catalog.placeOfSupply.sourceContact"),
  overseas: translate("catalog.placeOfSupply.sourceOverseas"),
};

/**
 * US-TAX-13 (D-146) — a draft's place of supply: it follows the contact
 * (site or shipping address, else billing), can be changed, and moving it
 * between intra- and inter-state switches item lines still on their item's
 * tax. Lines changed by hand keep their tax and are flagged.
 */
export function usePlaceOfSupply<L extends SwitchableLine>({
  contactId,
  initial,
  lines,
  setLines,
  direction = "sale",
}: {
  contactId: string;
  /** The saved draft's place of supply; undefined for a new document. */
  initial?: string | null;
  lines: L[];
  setLines: (lines: L[]) => void;
  direction?: "sale" | "purchase";
}) {
  const [profile, setProfile] = useState<TaxProfile | null>(null);
  const [contact, setContact] = useState<ContactForPlaceOfSupply | null>(null);
  const [placeOfSupply, setPlaceOfSupply] = useState<string | null>(initial ?? null);
  const [source, setSource] = useState<PlaceOfSupplySource | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<(ItemTaxes & { id: string })[]>([]);
  const loadedContact = useRef<string | null>(initial !== undefined ? contactId : null);

  useEffect(() => {
    apiClient
      .get<TaxProfile>("/org/tax/profile")
      .then(setProfile)
      .catch(() => setProfile({}));
    apiClient
      .get<(ItemTaxes & { id: string })[]>("/catalog-items?picker=1")
      .then(setItems)
      .catch(() => {});
  }, []);

  const businessState = profile?.country === "IN" && typeof profile.stateCode === "string" ? profile.stateCode : null;
  const active = businessState !== null;
  const exportUnderLut = profile?.exportUnderLut === true;
  const typeOf = useCallback(
    (pos: string | null) => supplyTypeFor({ businessState, placeOfSupply: pos, treatment: contact?.gstTreatment, direction }),
    [businessState, contact, direction],
  );
  const supplyType = typeOf(placeOfSupply);

  const change = useCallback(
    (next: string | null, nextSource: PlaceOfSupplySource | null, previousType: SupplyType | null, nextType: SupplyType | null) => {
      setPlaceOfSupply(next);
      setSource(nextSource);
      const result = switchLineTaxes(lines, items, previousType, nextType, { exportUnderLut });
      if (result.switched === 0 && result.flagged.length === 0) {
        setNotice(null);
        setFlagged(new Set());
        return;
      }
      setLines(result.lines);
      setFlagged(new Set(result.flagged));
      const to = nextType === "intra" ? translate("catalog.placeOfSupply.toIntra") : nextType === "export" && exportUnderLut ? translate("catalog.placeOfSupply.toExportLut") : translate("catalog.placeOfSupply.toIgst");
      const parts = [
        result.switched ? translate("catalog.placeOfSupply.switched", { count: result.switched, to }) : null,
        result.flagged.length ? translate("catalog.placeOfSupply.flagged", { count: result.flagged.length }) : null,
      ].filter(Boolean);
      setNotice(translate("catalog.placeOfSupply.notice", { label: placeOfSupplyLabel(next), parts: parts.join("; ") }));
    },
    [items, lines, setLines, exportUnderLut],
  );

  // A new contact brings its own place of supply.
  useEffect(() => {
    if (!contactId || !active) return;
    let cancelled = false;
    apiClient
      .get<ContactForPlaceOfSupply>(`/contacts/${contactId}?picker=1`)
      .then((c) => {
        if (cancelled) return;
        setContact(c);
        if (loadedContact.current === contactId) return;
        loadedContact.current = contactId;
        const found = placeOfSupplyFor(c);
        const nextType = supplyTypeFor({ businessState, placeOfSupply: found?.code ?? null, treatment: c.gstTreatment, direction });
        change(found?.code ?? null, found?.source ?? null, typeOf(placeOfSupply), nextType);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Only when the contact (or GST registration) changes, not on every line edit.
  }, [contactId, active]);

  return {
    /** GST applies: an Indian business with a GST state. */
    active,
    placeOfSupply,
    supplyType,
    /** D-181 — exports are zero-rated with no IGST. */
    exportUnderLut,
    source,
    notice,
    flagged,
    setPlaceOfSupply: (next: string) => change(next, null, supplyType, typeOf(next)),
    /**
     * US-AI-08 — takes a place of supply whose lines already carry the right
     * tax (AI's, matched by the API), for `forContactId`: no lines switch and
     * loading that contact doesn't replace it.
     */
    adopt: (next: string | null, forContactId: string | null) => {
      if (forContactId) loadedContact.current = forContactId;
      setPlaceOfSupply(next);
      setSource(null);
      setNotice(null);
      setFlagged(new Set());
    },
  };
}

/** "Place of supply" with where it came from and the tax it gives. */
export function PlaceOfSupplyField({
  value,
  onChange,
  source,
  supplyType,
  exportUnderLut = false,
}: {
  value: string | null;
  onChange: (value: string) => void;
  source: PlaceOfSupplySource | null;
  supplyType: SupplyType | null;
  exportUnderLut?: boolean;
}) {
  const t = useT();
  const kind = supplyType === "intra" ? t("catalog.placeOfSupply.kindIntra") : supplyType === "export" ? (exportUnderLut ? t("catalog.placeOfSupply.kindExportLut") : t("catalog.placeOfSupply.kindExport")) : supplyType === "inter" ? t("catalog.placeOfSupply.kindInter") : undefined;
  const helper = [source ? SOURCE_LABELS[source] : null, kind].filter(Boolean).join(" · ") || t("catalog.placeOfSupply.defaultHelper");
  return (
    <FormField label={t("catalog.placeOfSupply.label")} required helperText={helper}>
      {(field) => (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger {...field}>
            <SelectValue placeholder={t("catalog.placeOfSupply.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {GST_STATES.map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.name} ({s.code})
              </SelectItem>
            ))}
            <SelectItem value={POS_OTHER_COUNTRIES}>{placeOfSupplyLabel(POS_OTHER_COUNTRIES)}</SelectItem>
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}

/** The banner after the place of supply moves between intra- and inter-state. */
export function PlaceOfSupplyNotice({ notice }: { notice: string | null }) {
  if (!notice) return null;
  return <Alert variant="warning">{notice}</Alert>;
}

/** On a line whose tax was changed by hand when the place of supply changed. */
export function LineTaxWarning() {
  const t = useT();
  return (
    <p role="status" className="flex items-center gap-1.5 rounded-sm bg-due-soon-bg px-2 py-1 text-[12px] text-on-surface">
      <AlertTriangle size={14} aria-hidden className="shrink-0" />
      {t("catalog.placeOfSupply.lineTaxWarning")}
    </p>
  );
}
