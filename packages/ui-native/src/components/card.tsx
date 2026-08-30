import { Text, View, type TextProps, type ViewProps } from "react-native";

/** Ports `packages/ui`'s Card family to RN `View`/`Text` — same sub-component shape (Header/Title/Description/Content/Footer). */
export function Card({ className, ...props }: ViewProps) {
  return <View className={["rounded-lg border border-border bg-surface p-5", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardHeader({ className, ...props }: ViewProps) {
  return <View className={["mb-4 gap-1", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text accessibilityRole="header" className={["text-[15px] font-semibold text-on-surface", className].filter(Boolean).join(" ")} {...props} />
  );
}

export function CardDescription({ className, ...props }: TextProps) {
  return <Text className={["text-[13px] text-on-surface-muted", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardContent({ className, ...props }: ViewProps) {
  return <View className={className} {...props} />;
}

export function CardFooter({ className, ...props }: ViewProps) {
  return <View className={["mt-4 flex-row items-center gap-2", className].filter(Boolean).join(" ")} {...props} />;
}
