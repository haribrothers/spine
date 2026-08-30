import { Text, type TextProps } from "react-native";

/** Ports `packages/ui`'s Badge to RN — same reserved-semantic rule (never used for financial status, that stays StatusChip's job whenever a native StatusChip is built). */
export function Badge({ className, ...props }: TextProps) {
  return (
    <Text
      className={[
        "self-start rounded-full bg-surface-sunken px-2.5 py-0.5 text-[12px] font-medium text-on-surface-muted",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
