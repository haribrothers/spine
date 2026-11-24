import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

/** US-SITE-12: the copy bundled at /help leaves out the developer docs (online only). */
const bundled = process.env.DOCS_BUNDLED === "1";

export const collections = {
  docs: defineCollection({
    loader: glob({ base: "./src/content/docs", pattern: bundled ? ["**/[^_]*.{md,mdx}", "!developers/**"] : "**/[^_]*.{md,mdx}" }),
    schema: docsSchema(),
  }),
};
