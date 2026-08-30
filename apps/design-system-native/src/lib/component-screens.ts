import { ButtonScreen } from "../../app/components/button";
import { TextFieldScreen } from "../../app/components/text-field";
import { CardScreen } from "../../app/components/card";
import { BadgeScreen } from "../../app/components/badge";
import { TabBarScreen } from "../../app/components/tab-bar";
import { FloatingTabBarScreen } from "../../app/components/floating-tab-bar";
import { IntroductionScreen } from "../../app/overview";
import { TokensScreen } from "../../app/foundation";
import { AppShellScreen } from "../../app/layouts";
import { SampleScreensScreen } from "../../app/templates";
import type { DocScreenMap } from "./nav-sections";

/**
 * Maps each section's item slug to its doc screen — shared by both the
 * mobile per-section stacks (root-navigator.tsx) and the desktop content
 * pane (desktop-shell.tsx), so there's exactly one place to register a new
 * doc page's screen. Keep in sync with nav-sections.ts.
 */
export const DOC_SCREENS: DocScreenMap = {
  overview: {
    introduction: IntroductionScreen,
  },
  foundation: {
    tokens: TokensScreen,
  },
  layouts: {
    "app-shell": AppShellScreen,
  },
  components: {
    button: ButtonScreen,
    "text-field": TextFieldScreen,
    card: CardScreen,
    badge: BadgeScreen,
    "tab-bar": TabBarScreen,
    "floating-tab-bar": FloatingTabBarScreen,
  },
  templates: {
    "sample-screens": SampleScreensScreen,
  },
};
