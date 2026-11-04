# Motion

Motion in Spine is functional: it confirms that something changed, shows where something came from or went, and never decorates. Values are in [tokens.json](tokens.json) (`motion`) and as CSS variables `--duration-*` in `packages/config/tailwind-preset.css`.

## Durations and easing

| Token | Value | Use |
|---|---|---|
| `duration-instant` | 100ms | Hover and focus colour shifts |
| `duration-fast` | 150ms | Checkbox, switch, radio, toggle state |
| `duration-base` | 180ms | Default: dialog, drawer, popover, dropdown, toast enter/exit |
| `duration-slow` | 260ms | Page-level transitions, used sparingly |
| `easing-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Anything that moves within the screen |
| `easing-decelerate` | `cubic-bezier(0, 0, 0.2, 1)` | Things entering (dialog opening, toast arriving) |
| `easing-accelerate` | `cubic-bezier(0.4, 0, 1, 1)` | Things leaving (dialog closing, toast dismissing) |

## Patterns

| Pattern | Web | Native |
|---|---|---|
| Dialog / alert dialog | Fade overlay + scale 0.96→1, `duration-base`, decelerate in / accelerate out | Platform sheet or alert presentation (system-owned) |
| Drawer (detail panels) | Slide from right, `duration-base` | Bottom sheet (`BottomSheet`), system-owned |
| Toast | Slide up + fade, `duration-base`; auto-dismiss | `Toast`, same timings |
| Skeleton | Opacity pulse on slow loads only | Same |
| Tab bar selection | — | Native tabs animate the selection themselves (system-owned). The legacy `FloatingTabBar` slides its highlight with `Animated.spring` (bounciness 6) |
| Gauge / progress | — | `GaugeIndicator` fills with `Animated.spring` (slight overshoot then settle) |
| Drag to reorder (dashboard, line items) | Item lifts with a shadow; others shift with `duration-base` | — |
| Pull to refresh | — | Platform control |

## Reduced motion

When the user asks for reduced motion (`prefers-reduced-motion: reduce` on web; Reduce Motion on iOS; Remove animations on Android):

- All `--duration-*` values collapse to near zero (web) and springs are replaced by an instant `setValue` (native).
- Nothing that carries meaning is lost: a state change is still visible as a final state.
- Auto-advancing content (carousel) stops.

**How it's built (US-OPS-09, finding C25):** on web, `packages/config/tailwind-preset.css` collapses the `--duration-*` tokens to 0.01ms under `prefers-reduced-motion: reduce` and ends every transition and animation at once, so dialogs, drawers, menus, popovers and toasts appear in their final state. Spinners (`animate-spin`) keep turning: they're the only sign that work is going on. Native components read the setting with `useReduceMotion()` (or `isReduceMotionEnabled()` for a one-shot animation on mount) from `@spine/ui-native`: `GaugeIndicator`, `FloatingTabBar` and `FloatingLabelField` set the final value instead of springing or timing, `Skeleton` holds still and `Carousel` stops advancing. The field app's native tabs and sheets are system-owned and follow the setting themselves; its own Reanimated motion uses `useReducedMotion()`.

## Don'ts

- No motion on numbers in financial tables or totals (no count-up animations on money).
- No looping or attention-seeking animation; the unread badge does not pulse.
- No motion longer than 260ms, except the platform's own sheet and navigation transitions.
