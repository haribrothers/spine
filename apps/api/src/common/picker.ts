import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

/**
 * US-TEAM-31 (D-235) — true when `CapabilityGuard` let a `@PickerAllowed`
 * route through with `?picker=1` although the caller's section is closed.
 * The route then answers with only what other sections' forms need.
 */
export const SectionClosed = createParamDecorator((_data: unknown, context: ExecutionContext): boolean => context.switchToHttp().getRequest().sectionClosed === true);

/** Keeps only `keys` of a record — what a picker needs, nothing else. */
export function pickFields<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.filter((key) => key in row).map((key) => [key, row[key]])) as Pick<T, K>;
}

/** `pickFields` for a list, only when the section is closed (an open section gets the full rows). */
export function forPicker<T extends object, K extends keyof T>(closed: boolean, rows: T[], keys: readonly K[]): T[] | Pick<T, K>[] {
  return closed ? rows.map((row) => pickFields(row, keys)) : rows;
}
