// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";
import { SPINE_SITE_URL } from "../../packages/shared/src/public-site.ts";

/**
 * US-SITE-02 (D-273) — the home page at spine.<domain>, for people
 * discovering Spine. One splash page in the docs' theme; its links lead to
 * the docs, built into /docs/ on the same site (scripts/site/build-pages.mjs
 * checks them). No search of its own: the docs have it.
 */
export default defineConfig({
  site: SPINE_SITE_URL,
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "Spine",
      description: "Run your service business from one place: enquiry to quote, job, invoice, payment and books. Self-hosted, open source.",
      logo: { light: "./src/assets/logo-light.svg", dark: "./src/assets/logo-dark.svg", replacesTitle: true, alt: "Spine" },
      favicon: "/favicon.svg",
      customCss: ["./src/styles/tokens.css", "./src/styles/home.css"],
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/haribrothers/spine" }],
      pagefind: false,
      components: { Footer: "./src/components/Footer.astro" },
      plugins: [starlightLinksValidator({ errorOnLocalLinks: true, exclude: ["/docs/**"] })],
    }),
  ],
});
