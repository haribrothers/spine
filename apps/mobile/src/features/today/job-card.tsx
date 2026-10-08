import { Platform, Pressable, Text, View } from "react-native";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Flag from "lucide-react-native/icons/flag";
import MapPin from "lucide-react-native/icons/map-pin";
import Navigation from "lucide-react-native/icons/navigation";
import Phone from "lucide-react-native/icons/phone";
import { StatusChip, useNativeColors } from "@spine/ui-native";
import type { FieldJob } from "../../lib/data/jobs";
import { dueChip, oneLine } from "../../lib/format";
import { callNumber, openDirections } from "../../lib/linking";
import { PillButton } from "../../components/pill-button";
import { WaitingChip } from "../../components/waiting-chip";

/** "Call Alan Reyes" on iOS, "Call Alan" on Android (US-MOB-03). */
export function callLabel(name: string, os: typeof Platform.OS = Platform.OS): string {
  return `Call ${os === "android" ? (name.trim().split(/\s+/)[0] ?? name) : name}`;
}

/**
 * US-MOB-03 · `MobHomeJobs` — one of today's jobs: name, customer, site
 * address, the next milestone with its due chip, and "Call <contact>" and
 * "Directions". Tapping the card opens the job.
 */
export function TodayJobCard({ job, locale, onOpen, now, waiting = [] }: { job: FieldJob; locale: string; onOpen: () => void; now?: Date; waiting?: string[] }) {
  const colors = useNativeColors();
  const next = job.nextMilestone;
  const chip = next?.dueDate ? dueChip(next.dueDate, locale, now) : null;
  const phone = job.siteContact?.phone;
  return (
    <View testID={`today-job-${job.id}`} className="gap-3 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${job.name}, ${job.contactName ?? ""}`} className="gap-1.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-[17px] font-semibold text-on-surface dark:text-on-surface-dark">{job.name}</Text>
          <ChevronRight size={18} color={colors.onSurfaceMuted} />
        </View>
        {job.contactName ? <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">{job.contactName}</Text> : null}
        {job.siteAddress ? (
          <View className="flex-row items-center gap-2">
            <MapPin size={16} color={colors.onSurfaceMuted} />
            <Text className="flex-1 text-[15px] text-on-surface dark:text-on-surface-dark">{oneLine(job.siteAddress)}</Text>
          </View>
        ) : null}
        {next ? (
          <View className="flex-row flex-wrap items-center justify-between gap-2 pt-1">
            {chip ? <StatusChip status={chip.status}>{chip.label}</StatusChip> : <View />}
            {waiting.length ? (
              // US-MOB-07: what's still on the phone for this job takes the place of "Next".
              <View className="flex-row flex-wrap gap-1.5">
                {waiting.map((label) => (
                  <WaitingChip key={label} label={label} testID={`today-job-waiting-${job.id}`} />
                ))}
              </View>
            ) : (
              <View className="flex-shrink flex-row items-center gap-1.5">
                <Flag size={14} color={colors.onSurfaceMuted} />
                <Text numberOfLines={1} className="flex-shrink text-[13px] text-on-surface-muted dark:text-on-surface-muted-dark">
                  Next: {next.name}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </Pressable>
      {phone || job.siteAddress ? (
        <View className="flex-row gap-3">
          {phone && job.siteContact ? (
            <PillButton testID={`today-job-call-${job.id}`} grow label={callLabel(job.siteContact.name)} icon={Phone} onPress={() => void callNumber(phone)} />
          ) : null}
          {job.siteAddress ? (
            <PillButton
              testID={`today-job-directions-${job.id}`}
              grow
              outlined={Platform.OS === "android"}
              label="Directions"
              accessibilityLabel={`Directions to ${oneLine(job.siteAddress)}`}
              icon={Navigation}
              onPress={() => void openDirections(job.siteAddress!)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
