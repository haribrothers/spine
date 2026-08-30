import { useState } from "react";
import { View } from "react-native";
import { COMPONENT_REGISTRY } from "../lib/component-registry";
import { DesktopTopBar } from "./desktop-top-bar";
import { DesktopSidebar } from "./desktop-sidebar";
import { SearchPalette } from "./search-palette";
import { COMPONENT_SCREENS } from "../lib/component-screens";

/**
 * Desktop (>=768px) layout — mirrors apps/design-system's DocsShell: a
 * persistent top bar + sidebar with a content pane that swaps in place.
 * Selection is local component state, not React Navigation — there's no
 * page transition on a single-pane desktop layout, same as clicking a link
 * in a single-page web app just re-renders the content column.
 */
export function DesktopShell() {
  const [selectedSlug, setSelectedSlug] = useState(COMPONENT_REGISTRY[0]?.slug ?? "");
  const [searchOpen, setSearchOpen] = useState(false);
  const ScreenComponent = COMPONENT_SCREENS[selectedSlug];

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <DesktopTopBar onSearchOpen={() => setSearchOpen(true)} />
      <View className="flex-1 flex-row">
        <DesktopSidebar selectedSlug={selectedSlug} onSelect={setSelectedSlug} />
        <View className="mx-auto w-full max-w-[858px] flex-1">{ScreenComponent ? <ScreenComponent /> : null}</View>
      </View>
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} onSelect={setSelectedSlug} />
    </View>
  );
}
