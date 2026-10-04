# ActionTile

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/action-tile.tsx` · **Doc page:** none yet

An icon + label tile, tinted rounded box — for a wrapping grid of equal-width quick actions/shortcuts. Originally built for `apps/showcase-native`'s Home screen ("Quick actions": New quote/Log expense/Add photo/New job) — extracted here since the tile itself has no dashboard-specific logic; the specific action list and the grid's own `flex-wrap` layout stay screen-local.

## Import

```tsx
import { ActionTile } from "@spine/ui-native";
```

## Exports

`ActionTileProps` · `ActionTile`

## Accessibility

Automated check: `packages/ui-native/src/components/action-tile.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
