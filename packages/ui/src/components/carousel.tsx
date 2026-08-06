"use client";

import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createContext, forwardRef, useCallback, useContext, useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

type CarouselApi = UseEmblaCarouselType[1];
type CarouselOptions = Parameters<typeof useEmblaCarousel>[0];

interface CarouselContextValue {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: CarouselApi;
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
}

const CarouselContext = createContext<CarouselContextValue | null>(null);

function useCarousel() {
  const context = useContext(CarouselContext);
  if (!context) throw new Error("Carousel subcomponents must be used within <Carousel>");
  return context;
}

export interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  options?: CarouselOptions;
}

/**
 * Job/site photo galleries — a horizontally scrolling set of slides with
 * prev/next controls, built on embla-carousel. `role="region"` +
 * `aria-roledescription="carousel"` on the root and `aria-live="polite"` on
 * the slide track (see CarouselContent) let assistive tech announce slide
 * changes; the scroll-snap animation duration respects
 * `prefers-reduced-motion` (Embla's `duration` option, not a CSS
 * transition, so it can't be handled via Tailwind's motion tokens alone).
 */
export const Carousel = forwardRef<HTMLDivElement, CarouselProps>(
  ({ options, className, children, ...props }, ref) => {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(query.matches);
      const listener = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    }, []);

    const [carouselRef, api] = useEmblaCarousel({
      ...options,
      duration: prefersReducedMotion ? 0 : options?.duration,
    });
    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(false);

    const onSelect = useCallback((emblaApi: NonNullable<CarouselApi>) => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    }, []);

    useEffect(() => {
      if (!api) return;
      onSelect(api);
      api.on("select", onSelect);
      api.on("reInit", onSelect);
      return () => {
        api.off("select", onSelect);
        api.off("reInit", onSelect);
      };
    }, [api, onSelect]);

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api,
          scrollPrev: () => api?.scrollPrev(),
          scrollNext: () => api?.scrollNext(),
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={ref}
          role="region"
          aria-roledescription="carousel"
          className={cn("relative", className)}
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  },
);
Carousel.displayName = "Carousel";

export const CarouselContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { carouselRef } = useCarousel();
    return (
      <div ref={carouselRef} className="overflow-hidden">
        <div ref={ref} className={cn("flex", className)} {...props} />
      </div>
    );
  },
);
CarouselContent.displayName = "CarouselContent";

export const CarouselItem = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      aria-roledescription="slide"
      className={cn("min-w-0 shrink-0 grow-0 basis-full", className)}
      {...props}
    />
  ),
);
CarouselItem.displayName = "CarouselItem";

export function CarouselPrevious({ className }: { className?: string }) {
  const { scrollPrev, canScrollPrev } = useCarousel();
  return (
    <Button
      variant="secondary"
      size="icon"
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      aria-label="Previous slide"
      className={cn("absolute left-2 top-1/2 -translate-y-1/2", className)}
    >
      <ChevronLeft size={16} />
    </Button>
  );
}

export function CarouselNext({ className }: { className?: string }) {
  const { scrollNext, canScrollNext } = useCarousel();
  return (
    <Button
      variant="secondary"
      size="icon"
      disabled={!canScrollNext}
      onClick={scrollNext}
      aria-label="Next slide"
      className={cn("absolute right-2 top-1/2 -translate-y-1/2", className)}
    >
      <ChevronRight size={16} />
    </Button>
  );
}
