import { Text, View } from "react-native";
import { Divider } from "./divider";

/**
 * A small muted label + optional required-asterisk — `FormRow`'s own
 * implementation detail, not exported on its own (there is no standalone
 * reuse case for a bare field label outside a `FormRow`).
 */
function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text className="text-[14px] text-on-surface-muted dark:text-on-surface-muted-dark">
      {children}
      {required ? <Text className="text-overdue dark:text-overdue-dark"> *</Text> : null}
    </Text>
  );
}

/**
 * A fixed row height, applied identically to every row in a `FormSection`
 * card (text field, select, date picker, switch alike) — a real, reported
 * gap in an early version of this component: the labeled branch used
 * `min-h-11` while the label-omitted branch had no explicit height at all,
 * so each row's actual height came out however tall its own control
 * happened to render (a compact date-picker pill, a native text field's
 * system-default text, etc.), producing a visibly uneven row-height rhythm
 * down the card (confirmed on a real device). `ROW_HEIGHT` is deliberately
 * taller than a plain single-line `h-11` (44px) row, since a field with a
 * floating label needs room for BOTH the floated label caption and the
 * value text stacked vertically, not just one line — every row (including
 * plain-label ones) uses this same value so nothing in the card reads as
 * taller or shorter than its neighbors. Only the row's OWN control slot is
 * fixed at this height — an error message (see `error` below) is allowed
 * to add real height below it, on top of `ROW_HEIGHT`, rather than being
 * squeezed inside it.
 */
export const FORM_ROW_HEIGHT = 56;

/**
 * `FormRow`/`FormSection` — the grouped-card form layout originally built
 * for `apps/showcase-native`'s Job Edit template, extracted here so any
 * future form screen can reuse the exact same row/section shape instead of
 * re-deriving it. `FormSection` renders an uppercase caption above ONE
 * borderless card; each field inside it sits in a `FormRow`, with a
 * full-bleed `Divider` between rows (omitted after the last row via
 * `FormRow`'s `last` prop) — the card's shared surface is the only chrome,
 * individual fields draw no border/background of their own.
 *
 * One row inside a `FormSection` card, full-bleed `Divider` below (omit on
 * the last row via `last`). Two shapes, both fixed at `FORM_ROW_HEIGHT`:
 *
 * - `label` given (e.g. a `DateTimePicker`/`Switch` row, which has no
 *   floating-label treatment of its own): plain label left, control right.
 * - `label` omitted (e.g. a `FloatingLabelField`/floating-`SelectField`/
 *   `SelectListField` row): the field renders its OWN label internally, so
 *   this row is just a full-width slot with no separate label element — a
 *   side-by-side `FormRow` label here would visually double up with the
 *   field's own floating one.
 *
 * **`error` is part of the row itself, not a separate sibling element the
 * caller has to remember to place correctly — a real, reported bug this
 * fixes.** An earlier shape used a standalone error component called AFTER
 * a `FormRow`, as an unrelated sibling in the section's children list.
 * That broke in a few concrete, user-reported ways: (1) `FormRow` always
 * draws its own trailing `Divider` immediately after itself, so the
 * divider landed BETWEEN the row and its error message instead of below
 * the error — visually, the error text read as belonging to the NEXT
 * field, not the one that actually failed; (2) the error text had no
 * relationship to `FORM_ROW_HEIGHT` at all, so it broke the card's
 * carefully-unified row-height rhythm the moment any field errored; (3)
 * two independent call sites (`error={!!errors.x}` on the field itself, a
 * separate error element as a sibling) had to be kept in sync by hand for
 * every single validated field, with no structural link between them.
 * Fixed by making the row own its error entirely: rendered AFTER
 * `children` but BEFORE this row's own trailing `Divider`, so the divider
 * is always genuinely below the full row+error unit. Deliberately NOT
 * given a fixed height (unlike the row's own control slot) — a validation
 * error should only ever affect the layout of the ONE row it belongs to,
 * not reserve permanent empty space in every row up front or shift
 * unrelated rows.
 */
export function FormRow({
  label,
  required,
  children,
  last,
  error,
}: {
  label?: string;
  required?: boolean;
  children: React.ReactNode;
  last?: boolean;
  error?: string;
}) {
  return (
    <View>
      {label ? (
        <View style={{ height: FORM_ROW_HEIGHT }} className="flex-row items-center justify-between gap-3 px-4">
          <FieldLabel required={required}>{label}</FieldLabel>
          <View className="flex-1 items-end">{children}</View>
        </View>
      ) : (
        <View style={{ height: FORM_ROW_HEIGHT }} className="justify-center px-4">
          {children}
        </View>
      )}
      {error ? <Text className="px-4 pb-2 text-[12px] text-overdue dark:text-overdue-dark">{error}</Text> : null}
      {last ? null : <Divider />}
    </View>
  );
}

/**
 * The uppercase-caption + bordered-card wrapper `FormRow`s live inside.
 *
 * **The card uses `surface` (the lighter/whiter token in both modes), not
 * the page's own background — a real, reported bug fixed here, and the
 * reason this deserves its own note if you're building a screen around
 * this component.** A consuming screen's own page background and this
 * card's `surface` fill must be visually distinct in BOTH light and dark
 * mode, or the card reads as invisible/groupless — this was caught because
 * an early consumer's page background and `surface` were both `#FFFFFF` in
 * light mode (identical values), leaving the whole form looking flat with
 * no grouping at all in light mode specifically (dark mode was fine, since
 * that consumer's dark background/surface tokens already differed) — this
 * went unnoticed for a while because development happened mostly in dark
 * mode. **The fix belongs in the CONSUMING screen's own page background**
 * (e.g. resolving a `surfaceSunken`/`neutral100`-family token instead of
 * `background`), not in this component — `FormSection` itself is correct
 * as shipped (always `surface`, the lighter token); verify your own page's
 * background is visibly distinct from `surface` in both modes before
 * assuming this component provides contrast on its own.
 */
/** `title` is optional: a section straight under a heading (the field app's forms) has none. */
export function FormSection({ title, description, children }: { title?: string; description?: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      {title || description ? (
        <View className="gap-0.5 px-1">
          {title ? (
            <Text accessibilityRole="header" className="text-[13px] font-semibold uppercase tracking-wide text-on-surface-muted dark:text-on-surface-muted-dark">
              {title}
            </Text>
          ) : null}
          {description ? <Text className="text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">{description}</Text> : null}
        </View>
      ) : null}
      <View className="rounded-lg bg-surface dark:bg-surface-dark">{children}</View>
    </View>
  );
}
