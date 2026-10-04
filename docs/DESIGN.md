---
version: alpha
name: Spine
description: Visual identity for Spine, a self-hosted business management app for small service and project businesses — construction, fabrication, contracting, design studios — following the workflow enquiry to quote to job to invoice to payment to books.
colors:
  primary: "#2954E5"
  primary-hover: "#2044C4"
  neutral-50: "#FAFAF9"
  neutral-100: "#F2F1EE"
  neutral-200: "#E7E5E0"
  neutral-300: "#D3D0C9"
  neutral-500: "#726C5A" # WCAG AA pass (2026-08-06): darkened from #8A8578, which was 3.68:1 on surface / 3.26:1 on draft-bg — both fail 4.5:1 body text
  neutral-700: "#4B473E"
  neutral-900: "#211F1A"
  background: "#F7F6F3" # D-131 (US-OPS-32): warm page so white cards lift off it
  surface: "#FFFFFF"
  surface-sunken: "{colors.neutral-50}"
  on-surface: "{colors.neutral-900}"
  on-surface-muted: "{colors.neutral-500}"
  border: "{colors.neutral-200}"
  border-strong: "{colors.neutral-300}"
  paid: "#177044" # WCAG AA pass (2026-08-06): darkened from #1A7F4B, 4.44:1 on paid-bg — failed 4.5:1
  paid-bg: "#E4F5EB"
  due-soon: "#9A6300"
  due-soon-bg: "#FCF0D4"
  overdue: "#B3261E"
  overdue-bg: "#FBE6E4"
  on-primary: "#FFFFFF" # US-OPS-25 (D-099): text on filled primary controls
  on-danger: "#FFFFFF" # text on filled danger controls
  draft: "{colors.neutral-500}"
  draft-bg: "{colors.neutral-100}"
  info: "#2954E5"
  info-bg: "#EAEFFD"
  category-blue: "#2954E5"
  category-blue-bg: "#EAEFFD"
  category-green: "#1A7F4B"
  category-green-bg: "#E4F5EB"
  category-amber: "#9A6300"
  category-amber-bg: "#FCF0D4"
  category-red: "#B3261E"
  category-red-bg: "#FBE6E4"
  category-purple: "#7C3AED"
  category-purple-bg: "#F1E9FE"
  category-teal: "#0D6E6E" # WCAG AA pass (2026-08-06): darkened from #0F7C7C, 4.41:1 on category-teal-bg — failed 4.5:1
  category-teal-bg: "#DFF5F5"
  category-pink: "#A63571" # WCAG AA pass (2026-08-06): darkened from #C4408A, 3.93:1 on category-pink-bg — failed 4.5:1
  category-pink-bg: "#FBE4F1"
  category-slate: "{colors.neutral-700}"
  category-slate-bg: "{colors.neutral-100}"
colors-dark:
  primary: "#6B8AFF"
  primary-hover: "#88A1FF"
  neutral-50: "#171613"
  neutral-100: "#201F1B"
  neutral-200: "#2C2B26"
  neutral-300: "#3B392F"
  neutral-500: "#93907F"
  neutral-700: "#C7C4B8"
  neutral-900: "#F3F2EE"
  background: "#121110"
  surface: "#191815"
  surface-sunken: "{colors.neutral-200}"
  on-surface: "{colors.neutral-900}"
  on-surface-muted: "{colors.neutral-500}"
  border: "{colors.neutral-200}"
  border-strong: "{colors.neutral-300}"
  paid: "#4ADE94"
  paid-bg: "#132A1E"
  due-soon: "#F2B23D"
  due-soon-bg: "#332506"
  overdue: "#F17B72"
  overdue-bg: "#3A1512"
  on-primary: "#121110" # white on #6B8AFF is 3.1:1; this is 5.9:1
  on-danger: "#121110"
  draft: "{colors.neutral-500}"
  draft-bg: "{colors.neutral-100}"
  info: "#6B8AFF"
  info-bg: "#181F35"
  category-blue: "#6B8AFF"
  category-blue-bg: "#181F35"
  category-green: "#4ADE94"
  category-green-bg: "#132A1E"
  category-amber: "#F2B23D"
  category-amber-bg: "#332506"
  category-red: "#F17B72"
  category-red-bg: "#3A1512"
  category-purple: "#B79CFB"
  category-purple-bg: "#241A3D"
  category-teal: "#4FD1D1"
  category-teal-bg: "#0F2C2C"
  category-pink: "#EB8FC4"
  category-pink-bg: "#3A1B2C"
  category-slate: "{colors.neutral-700}"
  category-slate-bg: "{colors.neutral-100}"
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: -0.015em
  h1:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: -0.01em
  h2:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
  h3:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.4
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: 0.005em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: 0.01em
  mono-data:
    fontFamily: "IBM Plex Mono"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
    fontFeatureSettings: "tnum"
rounded:
  none: 0px
  sm: 6px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 20px
  xl: 32px
  2xl: 48px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1200px
  touch-target-min: 44px
breakpoints:
  mobile: 0px
  tablet: 768px
  desktop: 1024px
  wide: 1280px
motion:
  duration-instant: 100ms
  duration-fast: 150ms
  duration-base: 180ms
  duration-slow: 260ms
  easing-standard: cubic-bezier(0.4, 0, 0.2, 1)
  easing-decelerate: cubic-bezier(0, 0, 0.2, 1)
  easing-accelerate: cubic-bezier(0.4, 0, 1, 1)
z-index:
  dropdown: 1000
  sticky-header: 1100
  overlay: 1200
  modal: 1300
  popover: 1600
  toast: 1700
  tooltip: 1800
icons:
  library: lucide
  size-sm: 16px
  size-md: 18px
  size-lg: 20px
  size-xl: 24px
  stroke-width: 1.75
focus-ring:
  color: "{colors.primary}"
  width: 2px
  offset: 2px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 10px 16px
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.border}"
    textColor: "{colors.on-surface-muted}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    borderColor: "{colors.border-strong}"
    rounded: "{rounded.md}"
    padding: 10px 16px
    typography: "{typography.label}"
  button-secondary-hover:
    backgroundColor: "{colors.surface-sunken}"
  button-danger:
    backgroundColor: "{colors.overdue}"
    textColor: "{colors.on-danger}"
    rounded: "{rounded.md}"
    padding: 10px 16px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    borderColor: "{colors.border-strong}"
    rounded: "{rounded.sm}"
    padding: 8px 10px
    typography: "{typography.body-md}"
    height: 40px
  input-focus:
    borderColor: "{colors.primary}"
  input-error:
    borderColor: "{colors.overdue}"
  card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: 20px
  chip-paid:
    backgroundColor: "{colors.paid-bg}"
    textColor: "{colors.paid}"
    rounded: "{rounded.full}"
    padding: 3px 10px
    typography: "{typography.caption}"
  chip-due-soon:
    backgroundColor: "{colors.due-soon-bg}"
    textColor: "{colors.due-soon}"
    rounded: "{rounded.full}"
    padding: 3px 10px
    typography: "{typography.caption}"
  chip-overdue:
    backgroundColor: "{colors.overdue-bg}"
    textColor: "{colors.overdue}"
    rounded: "{rounded.full}"
    padding: 3px 10px
    typography: "{typography.caption}"
  chip-draft:
    backgroundColor: "{colors.draft-bg}"
    textColor: "{colors.draft}"
    rounded: "{rounded.full}"
    padding: 3px 10px
    typography: "{typography.caption}"
  nav-item-active:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
  table-row-hover:
    backgroundColor: "{colors.surface-sunken}"
  toast:
    backgroundColor: "{colors.neutral-900}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 10px 14px
    shadow: "0 4px 14px rgba(33,31,26,0.16)"
  modal:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 20px
    shadow: "0 10px 30px rgba(33,31,26,0.14)"
  popover:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
    shadow: "0 4px 14px rgba(33,31,26,0.10)"
  tooltip:
    backgroundColor: "{colors.neutral-900}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 4px 8px
    typography: "{typography.caption}"
  skeleton:
    backgroundColor: "{colors.border}"
    rounded: "{rounded.sm}"
  avatar:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
  stat-card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: 20px
---

# Spine — Design System

The token values above are the authored source for Spine's design tokens (read by `packages/config/tailwind-preset.css`, `packages/ui-native/src/tokens/`, and the generator that writes `docs/design/tokens.json`).

The brand book — voice, colour, type, layout, platforms, motion, accessibility and every component — lives in [docs/design/README.md](design/README.md).
