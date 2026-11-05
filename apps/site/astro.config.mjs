// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";

/**
 * US-SITE-02 (D-270) — the home page at h4loom.com, for people discovering
 * Spine. One splash page in the docs' theme; every link leads to
 * docs.h4loom.com. No search of its own: the docs have it.
 */
export default defineConfig({
  site: "https://h4loom.com",
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
      plugins: [starlightLinksValidator({ errorOnLocalLinks: true })],
    }),
  ],
});
