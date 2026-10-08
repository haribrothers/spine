import { ActionTileDemo } from "../components/demos/action-tile-demo";
import { AvatarDemo } from "../components/demos/avatar-demo";
import { BadgeDemo } from "../components/demos/badge-demo";
import { BottomSheetDemo } from "../components/demos/bottom-sheet-demo";
import { ButtonDemo } from "../components/demos/button-demo";
import { CardDemo } from "../components/demos/card-demo";
import { ContextMenuDemo } from "../components/demos/context-menu-demo";
import { DateTimePickerDemo } from "../components/demos/date-time-picker-demo";
import { DividerDemo } from "../components/demos/divider-demo";
import { ScrollEdgeMaskDemo } from "../components/demos/scroll-edge-mask-demo";
import { EmptyStateDemo } from "../components/demos/empty-state-demo";
import { FloatingLabelFieldDemo } from "../components/demos/floating-label-field-demo";
import { FormRowDemo } from "../components/demos/form-row-demo";
import { FullWidthButtonDemo } from "../components/demos/full-width-button-demo";
import { GaugeIndicatorDemo } from "../components/demos/gauge-indicator-demo";
import { KpiCardDemo } from "../components/demos/kpi-card-demo";
import { NativeTextFieldDemo } from "../components/demos/native-text-field-demo";
import { SegmentedControlDemo } from "../components/demos/segmented-control-demo";
import { SelectDemo } from "../components/demos/select-demo";
import { SelectFieldDemo } from "../components/demos/select-field-demo";
import { SelectListFieldDemo } from "../components/demos/select-list-field-demo";
import { SkeletonDemo } from "../components/demos/skeleton-demo";
import { SliderDemo } from "../components/demos/slider-demo";
import { SpinnerDemo } from "../components/demos/spinner-demo";
import { StatusChipDemo } from "../components/demos/status-chip-demo";
import { StepperDemo } from "../components/demos/stepper-demo";
import { SwitchDemo } from "../components/demos/switch-demo";
import { TextFieldDemo } from "../components/demos/text-field-demo";
import { ToastDemo } from "../components/demos/toast-demo";

/** Slug → demo component map, the sibling `[slug].tsx` looks up its content from. */
export const COMPONENT_DEMOS: Record<string, React.ComponentType> = {
  button: ButtonDemo,
  "full-width-button": FullWidthButtonDemo,
  switch: SwitchDemo,
  select: SelectDemo,
  "select-field": SelectFieldDemo,
  "select-list-field": SelectListFieldDemo,
  "segmented-control": SegmentedControlDemo,
  slider: SliderDemo,
  "context-menu": ContextMenuDemo,
  "date-time-picker": DateTimePickerDemo,
  "bottom-sheet": BottomSheetDemo,
  "text-field": TextFieldDemo,
  "native-text-field": NativeTextFieldDemo,
  "floating-label-field": FloatingLabelFieldDemo,
  "form-row": FormRowDemo,
  divider: DividerDemo,
  "scroll-edge-mask": ScrollEdgeMaskDemo,
  stepper: StepperDemo,
  card: CardDemo,
  badge: BadgeDemo,
  "status-chip": StatusChipDemo,
  avatar: AvatarDemo,
  "empty-state": EmptyStateDemo,
  spinner: SpinnerDemo,
  skeleton: SkeletonDemo,
  toast: ToastDemo,
  "gauge-indicator": GaugeIndicatorDemo,
  "kpi-card": KpiCardDemo,
  "action-tile": ActionTileDemo,
};
