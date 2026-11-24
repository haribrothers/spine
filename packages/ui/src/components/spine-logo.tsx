import { useId } from "react";
import { cn } from "../lib/cn";

export type SpineLogoVariant = "mark" | "horizontal" | "vertical";

export interface SpineLogoProps {
  /** The mark alone, the mark beside the wordmark, or the mark above it. */
  variant?: SpineLogoVariant;
  /** px — the mark's width and height, or a lockup's width. Clamped to the brand minimum. */
  size?: number;
  /** Hide it from screen readers when the word Spine is already next to it. */
  decorative?: boolean;
  className?: string;
}

/** Below these the layers' gaps close up and the "i" dot is lost. */
export const SPINE_LOGO_MIN = { mark: 20, lockup: 96 } as const;

const BOXES = { mark: [128, 128], horizontal: [437, 128], vertical: [289, 228] } as const;

/**
 * The mark's three layers from docs/logos/spine-logo.svg (a 128 × 128 box),
 * base first so the top layer draws last. The same paths as
 * `@spine/ui-native`'s SpineLogo (US-MOB-27); US-SET-26's test keeps them equal.
 */
export const SPINE_MARK_LAYERS = [
  {
    key: "base",
    y: [61.0838, 128],
    d: "M54.2039 63.2866C60.1236 60.3495 67.8764 60.3495 73.7961 63.2866L115.285 83.8711C125.572 88.9751 125.572 100.109 115.285 105.213L73.7961 125.797C67.8764 128.734 60.1236 128.734 54.2039 125.797L12.7153 105.213C2.42822 100.109 2.42822 88.9751 12.7153 83.8711L54.2039 63.2866Z",
  },
  {
    key: "mid",
    y: [30.5419, 97.4581],
    d: "M54.2039 32.7447C60.1236 29.8077 67.8764 29.8077 73.7961 32.7447L115.285 53.3292C125.572 58.4332 125.572 69.5669 115.285 74.6708L73.7961 95.2553C67.8764 98.1924 60.1236 98.1924 54.2039 95.2553L12.7153 74.6708C2.42822 69.5669 2.42822 58.4332 12.7153 53.3292L54.2039 32.7447Z",
  },
  {
    key: "top",
    y: [0, 66.9162],
    d: "M54.2039 2.20281C60.1236 -0.734268 67.8764 -0.73427 73.7961 2.20281L115.285 22.7873C125.572 27.8913 125.572 39.0249 115.285 44.1289L73.7961 64.7134C67.8764 67.6505 60.1236 67.6505 54.2039 64.7134L12.7153 44.1289C2.42822 39.0249 2.42822 27.8913 12.7153 22.7873L54.2039 2.20281Z",
  },
] as const;

/** SPiNE, from docs/logos/spine-logo-text.svg (horizontal lockup coordinates). */
export const SPINE_WORDMARK = [
  "M436.05 25.007V37.7622H406.399V57.3426H432.693V69.7622H406.399V90.4615H436.05V103.217H390.735V25.007H436.05Z",
  "M361.828 25.007H377.492V103.217H361.828L326.36 49.6223V103.217H310.695V25.007H326.36L361.828 78.7133V25.007Z",
  "M231.622 60.5874H244.042C252.881 60.5874 256.797 56.2238 256.797 49.2867C256.797 42.1259 252.881 37.8741 244.042 37.8741H231.622V60.5874ZM272.909 49.2867C272.909 61.1469 264.853 73.2308 244.713 73.2308H231.622V103.217H225.958C220.435 103.217 215.958 98.7397 215.958 93.2168V25.1189H244.713C263.51 25.1189 272.909 35.7483 272.909 49.2867Z",
  "M204.615 80.6154C204.615 92.9231 194.769 104 176.979 104C160.755 104 148.224 95.4965 148 80.7273H164.783C165.231 86.993 169.371 91.1329 176.643 91.1329C184.028 91.1329 188.392 87.2168 188.392 81.6224C188.392 64.7273 148.112 74.9091 148.224 46.6014C148.224 32.5035 159.636 24 175.748 24C191.748 24 202.713 32.1678 203.72 46.2657H186.49C186.154 41.1189 182.014 37.0909 175.301 36.979C169.147 36.7552 164.559 39.7762 164.559 46.1538C164.559 61.8182 204.615 53.0909 204.615 80.6154Z",
  "M282.154 102.988V51.6434H285.918C292.49 51.6434 297.818 56.0567 297.818 61.5008V102.988H282.154Z",
] as const;
const I_DOT = "M290.118 45.647C284.098 45.647 279.765 41.1019 279.765 35.2941C279.765 29.4864 284.098 24.9412 290.118 24.9412C296.016 24.9412 300.471 29.4864 300.471 35.2941C300.471 41.1019 296.016 45.647 290.118 45.647Z";

/**
 * US-SET-26 (D-206) — the Spine logo, drawn from the supplied SVG paths so
 * it stays sharp at any size. The wordmark uses `--color-brand-wordmark`
 * (Spine blue in light mode, light text in dark), never `primary`, so a
 * business's theme (US-SET-09) doesn't recolour it; dark mode is CSS, so
 * there's no swap after the page loads. Read as "Spine" unless `decorative`.
 */
export function SpineLogo({ variant = "mark", size, decorative = false, className }: SpineLogoProps) {
  const ids = `spine-logo-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [boxWidth, boxHeight] = BOXES[variant];
  const width = Math.max(size ?? (variant === "mark" ? 32 : 140), variant === "mark" ? SPINE_LOGO_MIN.mark : SPINE_LOGO_MIN.lockup);
  const height = Math.round(((width * boxHeight) / boxWidth) * 100) / 100;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${boxWidth} ${boxHeight}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("block shrink-0", className)}
      // eslint-disable-next-line i18next/no-literal-string -- the brand name
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": "Spine" })}
    >
      <defs>
        {SPINE_MARK_LAYERS.map((layer) => (
          <linearGradient key={layer.key} id={`${ids}-${layer.key}`} x1="64" y1={layer.y[0]} x2="64" y2={layer.y[1]} gradientUnits="userSpaceOnUse">
            <stop style={{ stopColor: `var(--color-brand-layer-${layer.key}-from)` }} />
            <stop offset="1" style={{ stopColor: `var(--color-brand-layer-${layer.key}-to)` }} />
          </linearGradient>
        ))}
        <linearGradient id={`${ids}-dot`} x1="290.118" y1="24.9412" x2="290.118" y2="45.647" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: "var(--color-brand-layer-top-from)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-brand-layer-top-to)" }} />
        </linearGradient>
      </defs>
      {/* The vertical lockup is the same art moved: the mark centred over the wordmark. */}
      <g transform={variant === "vertical" ? "translate(80.025 0)" : undefined}>
        {SPINE_MARK_LAYERS.map((layer) => (
          <path key={layer.key} d={layer.d} fill={`url(#${ids}-${layer.key})`} />
        ))}
      </g>
      {variant === "mark" ? null : (
        <g transform={variant === "vertical" ? "translate(-148 124)" : undefined}>
          {SPINE_WORDMARK.map((d) => (
            <path key={d.slice(0, 12)} d={d} style={{ fill: "var(--color-brand-wordmark)" }} />
          ))}
          <path d={I_DOT} fill={`url(#${ids}-dot)`} />
        </g>
      )}
    </svg>
  );
}
