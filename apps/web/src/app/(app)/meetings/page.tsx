import { AppShellHeader } from "@spine/ui";
import { MeetingsCalendar } from "./meetings-calendar";

/**
 * S-01.9 — schedule and view meetings with contacts on a calendar. Full
 * width (see app-layout.tsx's FULL_WIDTH_ROUTES, same reasoning as
 * /leads's pipeline board): a scheduling calendar is wide-by-nature
 * content, not a form/reading-width page.
 */
export default function MeetingsPage() {
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Sales" }, { label: "Meetings" }]} title="Meetings" description="Schedule and view meetings with your contacts." />
      <MeetingsCalendar />
    </>
  );
}
