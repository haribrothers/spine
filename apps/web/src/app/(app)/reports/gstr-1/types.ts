/** US-TAX-16 — `GET /exports/gstr1?format=summary`. */
export interface Gstr1Figures {
  count: number;
  taxableValue: string;
  tax: string;
}

export interface Gstr1DocumentRange {
  kind: "invoice" | "credit_note";
  from: string;
  to: string;
  total: number;
  cancelled: number;
}

export interface Gstr1Summary {
  period: { kind: "monthly" | "quarterly"; from: string; to: string; fp: string; label: string };
  gstin: string;
  schemaVersion: string;
  tables: Record<"b2b" | "b2cl" | "b2cs" | "cdnr" | "cdnur" | "exp" | "nil" | "hsn", Gstr1Figures> & { docs: Gstr1DocumentRange[] };
  totals: { documents: number; taxableValue: string; tax: string };
  footer: string;
}
