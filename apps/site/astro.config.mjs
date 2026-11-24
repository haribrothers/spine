// @ts-check
import { defineConfig } from "astro/config";
import { SPINE_SITE_URL } from "../../packages/shared/src/public-site.ts";

/**
 * US-SITE-02 (D-273, D-275) — the home page at spine.<domain>, for people
 * discovering Spine. Its own Astro page, not a Starlight one, so the layout
 * and motion aren't boxed in; the docs stay on Starlight under /docs/
 * (scripts/site/build-pages.mjs builds both and checks the home page's links).
 */
export default defineConfig({
  site: SPINE_SITE_URL,
  trailingSlash: "always",
  build: { inlineStylesheets: "auto" },
});
