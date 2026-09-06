import { ButtonScreen } from "../../app/components/button";
import { TextFieldScreen } from "../../app/components/text-field";
import { NativeTextFieldScreen } from "../../app/components/native-text-field";
import { SelectScreen } from "../../app/components/select";
import { SelectFieldScreen } from "../../app/components/select-field";
import { DateTimePickerScreen } from "../../app/components/date-time-picker";
import { CardScreen } from "../../app/components/card";
import { AvatarScreen } from "../../app/components/avatar";
import { BadgeScreen } from "../../app/components/badge";
import { StatusChipScreen } from "../../app/components/status-chip";
import { EmptyStateScreen } from "../../app/components/empty-state";
import { SpinnerScreen } from "../../app/components/spinner";
import { ToastScreen } from "../../app/components/toast";
import { SkeletonScreen } from "../../app/components/skeleton";
import { TabBarScreen } from "../../app/components/tab-bar";
import { FloatingTabBarScreen } from "../../app/components/floating-tab-bar";
import { NativeTabViewScreen } from "../../app/components/native-tab-view";
import { NativeHeaderScreen } from "../../app/components/native-header";
import { IntroductionScreen } from "../../app/overview";
import { PrinciplesScreen } from "../../app/principles";
import { ColorScreen } from "../../app/foundation/color";
import { TypographyScreen } from "../../app/foundation/typography";
import { SpacingScreen } from "../../app/foundation/spacing";
import { IconsScreen } from "../../app/foundation/icons";
import { MotionScreen } from "../../app/foundation/motion";
import { LayoutPrimitivesScreen } from "../../app/layouts/primitives";
import { JobListScreen } from "../../app/templates/job-list";
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
    principles: PrinciplesScreen,
  },
  foundation: {
    color: ColorScreen,
    typography: TypographyScreen,
    spacing: SpacingScreen,
    icons: IconsScreen,
    motion: MotionScreen,
  },
  layouts: {
    primitives: LayoutPrimitivesScreen,
  },
  components: {
    button: ButtonScreen,
    "text-field": TextFieldScreen,
    "native-text-field": NativeTextFieldScreen,
    select: SelectScreen,
    "select-field": SelectFieldScreen,
    "date-time-picker": DateTimePickerScreen,
    card: CardScreen,
    avatar: AvatarScreen,
    badge: BadgeScreen,
    "status-chip": StatusChipScreen,
    "empty-state": EmptyStateScreen,
    spinner: SpinnerScreen,
    toast: ToastScreen,
    skeleton: SkeletonScreen,
    "tab-bar": TabBarScreen,
    "floating-tab-bar": FloatingTabBarScreen,
    "native-tab-view": NativeTabViewScreen,
    "native-header": NativeHeaderScreen,
  },
  templates: {
    "job-list": JobListScreen,
  },
};
