import { View } from "react-native";
import { CodeBlock } from "./code-block";

export function ComponentPreview({ code, children }: { code?: string; children: React.ReactNode }) {
  return (
    <View className="my-2 overflow-hidden rounded-lg border border-border dark:border-border-dark">
      <View className="min-h-32 items-center justify-center bg-surface-sunken dark:bg-surface-sunken-dark p-6">{children}</View>
      {code ? (
        <View className="border-t border-border dark:border-border-dark">
          <CodeBlock code={code} />
        </View>
      ) : null}
    </View>
  );
}
