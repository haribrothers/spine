import { Platform, View } from "react-native";
import { Skeleton } from "@spine/ui-native";
import { useT } from "../lib/i18n";

/**
 * D-201 — what a section shows while its first data is on the way: blocks
 * in the shape of what's coming, so nothing jumps when it arrives. There is
 * no full-page loader: the read cache shows what was saved at once, and a
 * pull to refresh has the platform's own spinner. Each region is announced
 * once ("Loading jobs", busy); the blocks themselves are hidden from screen
 * readers.
 */
export function LoadingRegion({ label, testID, className, children }: { label: string; testID?: string; className?: string; children: React.ReactNode }) {
  return (
    <View testID={testID} accessible accessibilityLabel={label} accessibilityState={{ busy: true }} className={className}>
      {children}
    </View>
  );
}

/** The welcome card's gauge and its two lines. */
export function GaugeSkeleton() {
  const t = useT();
  return (
    <LoadingRegion label={t("mobileApp.skeletons.milestones")} testID="skeleton-gauge" className="w-full items-center gap-3 pt-2">
      {/* An arc like the gauge: a half-disc with the card's own colour over its middle. */}
      <View className="h-28 w-56">
        <Skeleton className="h-28 w-56 rounded-t-full" />
        <View className="absolute bottom-0 left-4 h-24 w-48 rounded-t-full bg-surface-sunken dark:bg-surface-sunken-dark" />
      </View>
      <Skeleton className="h-3 w-32 rounded-full" />
      <Skeleton className="h-4 w-24 rounded-full" />
    </LoadingRegion>
  );
}

/** Three KPI cards, the third peeking like the real carousel. */
export function KpiCardsSkeleton({ width, gap }: { width: number; gap: number }) {
  const t = useT();
  return (
    <LoadingRegion label={t("mobileApp.skeletons.figures")} testID="skeleton-kpis" className="-mx-4 flex-row overflow-hidden px-4">
      <View className="flex-row" style={{ gap }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[104px] rounded-2xl" style={{ width }} />
        ))}
      </View>
    </LoadingRegion>
  );
}

/** A job card on Today: title, customer, address, chip, and the two buttons. */
export function JobCardSkeleton() {
  return (
    <View className="gap-3 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <Skeleton className="h-5 w-2/3 rounded-md" />
      <Skeleton className="h-4 w-1/2 rounded-md" />
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <Skeleton className="h-6 w-24 rounded-full" />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Skeleton className="h-11 rounded-full" />
        </View>
        <View className="flex-1">
          <Skeleton className="h-11 rounded-full" />
        </View>
      </View>
    </View>
  );
}

export function JobCardsSkeleton({ count = 2 }: { count?: number }) {
  const t = useT();
  return (
    <LoadingRegion label={t("mobileApp.skeletons.jobs")} testID="skeleton-job-cards" className="gap-3">
      {Array.from({ length: count }, (_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </LoadingRegion>
  );
}

/**
 * List rows: an optional leading tile (Android's job icon, a notification
 * icon), two lines, an optional trailing pill or amount. Grouped in a
 * rounded card on iOS, edge to edge on Android, like the lists they stand in for.
 */
export function ListRowsSkeleton({
  label,
  testID,
  rows = 4,
  leading = false,
  trailing = "none",
  grouped = Platform.OS === "ios",
}: {
  label: string;
  testID?: string;
  rows?: number;
  leading?: boolean;
  trailing?: "none" | "pill" | "amount";
  grouped?: boolean;
}) {
  return (
    <LoadingRegion label={label} testID={testID} className={grouped ? "overflow-hidden rounded-2xl bg-surface dark:bg-surface-dark" : ""}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className={`flex-row items-center gap-3 px-4 py-3.5 ${i ? "border-t border-border dark:border-border-dark" : ""}`}>
          {leading ? <Skeleton className="h-11 w-11 rounded-xl" /> : null}
          <View className="flex-1 gap-2">
            <Skeleton className="h-4 w-3/5 rounded-md" />
            <Skeleton className="h-3 w-2/5 rounded-md" />
          </View>
          {trailing === "pill" ? <Skeleton className="h-11 w-32 rounded-full" /> : trailing === "amount" ? <Skeleton className="h-4 w-16 rounded-md" /> : null}
        </View>
      ))}
    </LoadingRegion>
  );
}

/** A grid of square photo tiles. */
export function PhotoGridSkeleton({ rows = 1, columns = 4, size, gap = 4, label }: { rows?: number; columns?: number; size?: number; gap?: number; label?: string }) {
  const t = useT();
  return (
    <LoadingRegion label={label ?? t("mobileApp.skeletons.photos")} testID="skeleton-photos" className="gap-1">
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} className="flex-row" style={{ gap }}>
          {Array.from({ length: columns }, (_, c) => (
            <View key={c} style={size ? { width: size, height: size } : { flex: 1, aspectRatio: 1 }}>
              <Skeleton className="rounded-md" style={{ flex: 1 }} />
            </View>
          ))}
        </View>
      ))}
    </LoadingRegion>
  );
}

/** The next meeting card. */
export function MeetingCardSkeleton() {
  const t = useT();
  return (
    <LoadingRegion label={t("mobileApp.skeletons.meeting")} testID="skeleton-meeting" className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4 dark:border-border-dark dark:bg-surface-dark">
      <Skeleton className="h-11 w-11 rounded-xl" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
      </View>
    </LoadingRegion>
  );
}

/** A detail screen's heading block: chip, title, subtitle. */
export function HeadingSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label} testID="skeleton-heading" className="gap-2">
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-8 w-4/5 rounded-md" />
      <Skeleton className="h-4 w-1/2 rounded-md" />
    </LoadingRegion>
  );
}

/** A grouped card of label/value rows (an expense, a meeting, a job's site). */
export function CardRowsSkeleton({ rows = 3, label, testID }: { rows?: number; label: string; testID?: string }) {
  return (
    <LoadingRegion label={label} testID={testID} className="overflow-hidden rounded-2xl border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className={`flex-row items-center justify-between gap-4 px-4 py-3.5 ${i ? "border-t border-border dark:border-border-dark" : ""}`}>
          <Skeleton className="h-4 w-1/3 rounded-md" />
          <Skeleton className="h-4 w-1/4 rounded-md" />
        </View>
      ))}
    </LoadingRegion>
  );
}
