# SelectListField

**Package:** `@spine/ui-native` · **Platform:** Native · **Source:** `packages/ui-native/src/components/select-list-field.tsx` · **Doc page:** none yet

RN exposes `ScrollView.Context` (a real React context whose value tells `VirtualizedList` whether it has an enclosing `ScrollView`, and in which orientation) at runtime — confirmed by reading `ScrollView.js` itself (`static Context: typeof ScrollViewContext = ScrollViewContext`) — but `@types/react-native`'s public `.d.ts` for `ScrollView` doesn't declare that static property, so TypeScript doesn't know it exists. This narrow cast exposes just that one property with its real shape (a `Context` of `"HORIZONTAL" | "VERTICAL" | null`, per RN's own `ScrollViewContext.js`) rather than casting the whole render to `any`.

## Import

```tsx
import { SelectListFieldOption, SelectListField } from "@spine/ui-native";
```

## Exports

`SelectListFieldOption` · `SelectListFieldProps` · `SelectListField`

## Accessibility

Automated check: `packages/ui-native/src/components/select-list-field.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
