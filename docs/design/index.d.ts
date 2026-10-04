/**
 * Spine design system — type surface.
 *
 * The component libraries are real packages in this repo, so this file points at
 * their entry points instead of copying their declarations (which would drift).
 * Per-component props are summarised in ./components/<Name>.md.
 *
 *   Web:    @spine/ui                    → packages/ui/src/index.ts
 *   Native: @spine/ui-native             → packages/ui-native/src/index.ts
 *           @spine/ui-native/tokens      → packages/ui-native/src/tokens/index.ts
 *           @spine/ui-native/navigation  → packages/ui-native/src/navigation/index.ts
 */
export * from "../../packages/ui/src/index";
export * as native from "../../packages/ui-native/src/index";
export * as nativeTokens from "../../packages/ui-native/src/tokens/index";
