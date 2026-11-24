import type { MeetingAttendeeStatus } from "./types";
import { t } from "../../../lib/i18n";

export const STATUS_LABEL: Record<MeetingAttendeeStatus, string> = {
  invited: t("meetings.attendeeStatus.invited"),
  accepted: t("meetings.attendeeStatus.accepted"),
  declined: t("meetings.attendeeStatus.declined"),
  tentative: t("meetings.attendeeStatus.tentative"),
};

/** Badge itself is intentionally neutral-toned (see its own doc comment — StatusChip is reserved for financial status), so attendee-response color is applied here via className rather than a Badge variant. */
export const STATUS_CLASSNAME: Record<MeetingAttendeeStatus, string> = {
  invited: "",
  accepted: "bg-paid-bg text-paid",
  declined: "bg-overdue-bg text-overdue",
  tentative: "bg-due-soon-bg text-due-soon",
};
