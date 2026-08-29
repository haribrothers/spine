import expoConfig from "eslint-config-expo/flat.js";
import base from "./eslint.config.js";

/**
 * Composes this repo's shared base rules (unused-vars convention, etc.)
 * with `eslint-config-expo`'s own React/React Native/React Hooks rule set
 * — hand-rolling those from scratch would mean re-deriving a maintained
 * project's own opinions about hooks-rules-of-hooks, RN-specific globals,
 * and Metro's module resolution, none of which `@spine/config/eslint`
 * (a plain TS-only base with no framework awareness, consumed by NestJS
 * and Next.js differently already) has any opinion about.
 */
export default [...expoConfig, ...base, { ignores: [".expo/**", "android/**", "ios/**"] }];
