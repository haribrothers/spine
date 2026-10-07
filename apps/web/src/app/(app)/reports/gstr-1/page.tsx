import { ReportShell } from "../report-shell";
import { Gstr1View } from "./gstr1-view";

/** US-TAX-16 — GSTR-1 for the GST portal. */
export default function Gstr1Page() {
  return (
    <ReportShell slug="gstr-1" description="Outward supplies for the GST portal">
      <Gstr1View />
    </ReportShell>
  );
}
