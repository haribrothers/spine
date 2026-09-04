import { AvatarDemo } from "../components/demos/avatar-demo";
import { BadgeDemo } from "../components/demos/badge-demo";
import { BottomSheetDemo } from "../components/demos/bottom-sheet-demo";
import { ButtonDemo } from "../components/demos/button-demo";
import { CardDemo } from "../components/demos/card-demo";
import { ContextMenuDemo } from "../components/demos/context-menu-demo";
import { DateTimePickerDemo } from "../components/demos/date-time-picker-demo";
import { EmptyStateDemo } from "../components/demos/empty-state-demo";
import { SelectDemo } from "../components/demos/select-demo";
import { SkeletonDemo } from "../components/demos/skeleton-demo";
import { SliderDemo } from "../components/demos/slider-demo";
import { SpinnerDemo } from "../components/demos/spinner-demo";
import { StatusChipDemo } from "../components/demos/status-chip-demo";
import { SwitchDemo } from "../components/demos/switch-demo";
import { TextFieldDemo } from "../components/demos/text-field-demo";
import { ToastDemo } from "../components/demos/toast-demo";

/** Slug → demo component map, the sibling `[slug].tsx` looks up its content from. */
export const COMPONENT_DEMOS: Record<string, React.ComponentType> = {
  button: ButtonDemo,
  switch: SwitchDemo,
  select: SelectDemo,
  slider: SliderDemo,
  "context-menu": ContextMenuDemo,
  "date-time-picker": DateTimePickerDemo,
  "bottom-sheet": BottomSheetDemo,
  "text-field": TextFieldDemo,
  card: CardDemo,
  badge: BadgeDemo,
  "status-chip": StatusChipDemo,
  avatar: AvatarDemo,
  "empty-state": EmptyStateDemo,
  spinner: SpinnerDemo,
  skeleton: SkeletonDemo,
  toast: ToastDemo,
};
