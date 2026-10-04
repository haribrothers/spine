# NavigationMenu

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/navigation-menu.tsx` · **Doc page:** `apps/design-system/src/app/components/navigation-menu/page.tsx`

A collection of links for navigating websites. A horizontal bar with dropdown/mega-menu lists — for a top-level marketing-style nav with grouped links; NavItem/SideNav remain the pattern for a vertical admin sidebar, don't reach for this there.

## Import

```tsx
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `…` | standard Radix NavigationMenu props | — |

## Rules and behaviour

- Can display simple links or rich dropdown content per top-level item.
- Full keyboard navigation.
- Accessible on both mouse and keyboard, including support for RTL direction.

## Exports

`NavigationMenu` · `NavigationMenuList` · `NavigationMenuItem` · `navigationMenuTriggerStyle` · `NavigationMenuTrigger` · `NavigationMenuContent` · `NavigationMenuLink` · `NavigationMenuViewport` · `NavigationMenuIndicator`

## Accessibility

Automated check: `packages/ui/src/components/navigation-menu.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
