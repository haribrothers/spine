import { useState } from "react";
import { View } from "react-native";
import { findSection, NAV_SECTIONS, type SectionSlug } from "../lib/nav-sections";
import { DesktopTopBar } from "./desktop-top-bar";
import { DesktopSidebar } from "./desktop-sidebar";
import { SearchPalette } from "./search-palette";
import { DOC_SCREENS } from "../lib/component-screens";

const firstSection = NAV_SECTIONS[0]!;

/**
 * Desktop (>=768px) layout — mirrors apps/design-system's DocsShell: a
 * persistent top bar with a pill-style section nav (Overview/Foundation/
 * Layouts/Components/Templates) + a sidebar scoped to the active section's
 * own items + a content pane that swaps in place. Selection is local
 * component state, not React Navigation — there's no page transition on a
 * single-pane desktop layout, same as clicking a link in a single-page web
 * app just re-renders the content column.
 */
export function DesktopShell() {
  const [selectedSection, setSelectedSection] = useState<SectionSlug>(firstSection.slug);
  const [selectedSlug, setSelectedSlug] = useState(firstSection.items[0]?.slug ?? "");
  const [searchOpen, setSearchOpen] = useState(false);
  const ScreenComponent = DOC_SCREENS[selectedSection][selectedSlug];

  function handleSelect(slug: string, section: SectionSlug) {
    setSelectedSection(section);
    setSelectedSlug(slug);
  }

  function handleSelectSection(section: SectionSlug) {
    setSelectedSection(section);
    setSelectedSlug(findSection(section).items[0]?.slug ?? "");
  }

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <DesktopTopBar selectedSection={selectedSection} onSelectSection={handleSelectSection} onSearchOpen={() => setSearchOpen(true)} />
      <View className="flex-1 flex-row">
        <DesktopSidebar activeSection={selectedSection} selectedSlug={selectedSlug} onSelect={handleSelect} />
        <View className="mx-auto w-full max-w-[858px] flex-1">{ScreenComponent ? <ScreenComponent /> : null}</View>
      </View>
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} onSelect={handleSelect} />
    </View>
  );
}
