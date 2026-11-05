import { Text, View } from "react-native";
import type { FieldJob } from "../../lib/data/jobs";
import { t } from "../../lib/i18n";

const LABEL: Record<FieldJob["status"], () => string> = {
  active: () => t("mobileWork.jobStatus.active"),
  on_hold: () => t("mobileWork.jobStatus.onHold"),
  completed: () => t("mobileWork.jobStatus.completed"),
  cancelled: () => t("mobileWork.jobStatus.cancelled"),
};
const STYLE: Record<FieldJob["status"], { box: string; text: string }> = {
  active: { box: "bg-info-bg dark:bg-info-bg-dark", text: "text-primary dark:text-primary-dark" },
  on_hold: { box: "bg-due-soon-bg dark:bg-due-soon-bg-dark", text: "text-due-soon dark:text-due-soon-dark" },
  completed: { box: "bg-paid-bg dark:bg-paid-bg-dark", text: "text-paid dark:text-paid-dark" },
  cancelled: { box: "bg-draft-bg dark:bg-draft-bg-dark", text: "text-draft dark:text-draft-dark" },
};

/** A job's status as a chip ("Active" in the info tint, as drawn). */
export function JobStatusChip({ status }: { status: FieldJob["status"] }) {
  return (
    <View testID="job-status" className={`self-start rounded-full px-2.5 py-0.5 ${STYLE[status].box}`}>
      <Text className={`text-[13px] font-medium ${STYLE[status].text}`}>{LABEL[status]()}</Text>
    </View>
  );
}
