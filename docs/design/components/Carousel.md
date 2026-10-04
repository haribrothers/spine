# Carousel

**Package:** `@spine/ui` · **Platform:** Web · **Source:** `packages/ui/src/components/carousel.tsx` · **Doc page:** `apps/design-system/src/app/components/carousel/page.tsx`

A carousel with motion and swipe built using embla-carousel. Job/site photo galleries — a horizontally scrolling set of slides with prev/next controls.

## Import

```tsx
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@spine/ui";
```

## Props

| Prop | Type | Default |
|---|---|---|
| `options` | embla-carousel-react's UseEmblaCarouselType options | — |

## Rules and behaviour

- Touch/swipe support on mobile.
- Prev/Next controls automatically disable at the ends.
- Options object passes through to embla-carousel directly.

## Exports

`CarouselProps` · `Carousel` · `CarouselContent` · `CarouselItem` · `CarouselPrevious` · `CarouselNext`

## Accessibility

Automated check: `packages/ui/src/components/carousel.a11y.test.tsx`. Keyboard, focus ring and labelling rules from [README](../README.md#accessibility) apply.
