import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { MeetingsCalendar } from "./meetings-calendar";
import { t } from "../../../lib/i18n";

/**
 * S-01.9 — schedule and view meetings with contacts on a calendar. Full
 * width (see app-layout.tsx's FULL_WIDTH_ROUTES, same reasoning as
 * /leads's pipeline board): a scheduling calendar is wide-by-nature
 * content, not a form/reading-width page.
 */
export default function MeetingsPage() {
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: t("meetings.page.sales") }, { label: t("meetings.page.title") }]} title={t("meetings.page.title")} description={t("meetings.page.description")} />
      {/* MeetingsCalendar reads ?id= (S-10.20/S-10.21 notification deep links) via useSearchParams, which requires a Suspense boundary. */}
      <Suspense>
        <MeetingsCalendar />
      </Suspense>
    </>
  );
}
