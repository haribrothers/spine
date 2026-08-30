import { ScrollView, type ScrollViewProps } from "react-native";

/** Scrollable page wrapper for a component doc screen — see doc-page.tsx for the DocTitle/DocSection/etc. content primitives. */
export function DocScreen({ children, ...props }: ScrollViewProps) {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-2 p-4" {...props}>
      {children}
    </ScrollView>
  );
}
