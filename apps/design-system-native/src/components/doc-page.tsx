import { Text, View } from "react-native";

/**
 * RN port of apps/design-system's doc-page.tsx primitives — same visual
 * language (type scale, spacing, colors) rendered via View/Text instead of
 * DOM elements. KeyboardTable has no native equivalent (no keyboard
 * interactions on touch) and isn't ported.
 */
export function DocTitle({ children }: { children: React.ReactNode }) {
  return <Text className="mb-1 text-[28px] font-bold tracking-tight text-on-surface">{children}</Text>;
}

export function DocLead({ children }: { children: React.ReactNode }) {
  return <Text className="my-3 text-[14px] leading-relaxed text-on-surface">{children}</Text>;
}

export function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-8 gap-3">
      <Text className="text-[20px] font-semibold tracking-tight text-on-surface">{title}</Text>
      {children}
    </View>
  );
}

export function DocSubsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-4 gap-2">
      <Text className="text-[15px] font-semibold text-on-surface">{title}</Text>
      {children}
    </View>
  );
}

/** The Features section's bulleted capability list — matches web's Radix-Primitives-style pattern. */
export function FeatureList({ items }: { items: string[] }) {
  return (
    <View className="my-1 gap-1.5">
      {items.map((item) => (
        <View key={item} className="flex-row gap-2">
          <Text className="text-[14px] text-on-surface">{"•"}</Text>
          <Text className="flex-1 text-[14px] text-on-surface">{item}</Text>
        </View>
      ))}
    </View>
  );
}

export interface ApiRow {
  prop: string;
  type: string;
  defaultValue?: string;
}

export function ApiTable({ rows, caption }: { rows: ApiRow[]; caption?: string }) {
  return (
    <View className="my-1 gap-2">
      {caption ? <Text className="text-[13px] font-medium text-on-surface">{caption}</Text> : null}
      <View className="overflow-hidden rounded-lg border border-border">
        <View className="flex-row border-b border-border bg-surface-sunken px-4 py-2">
          <Text className="w-[34%] text-[12px] font-medium text-on-surface-muted">Prop</Text>
          <Text className="w-[40%] text-[12px] font-medium text-on-surface-muted">Type</Text>
          <Text className="flex-1 text-[12px] font-medium text-on-surface-muted">Default</Text>
        </View>
        {rows.map((row, index) => (
          <View
            key={row.prop}
            className={["flex-row px-4 py-2", index < rows.length - 1 ? "border-b border-border" : ""].join(" ")}
          >
            <Text className="w-[34%] font-mono text-[12px] text-on-surface">{row.prop}</Text>
            <Text className="w-[40%] font-mono text-[12px] text-on-surface-muted">{row.type}</Text>
            <Text className="flex-1 font-mono text-[12px] text-on-surface-muted">{row.defaultValue ?? "—"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
