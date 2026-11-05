/**
 * D-273 — where Spine is published: the home page at spine.<domain>, the docs
 * under /docs/ on the same site. Change the domain here, and only here: the
 * sites, the app's Help menu and the tests read it, and
 * scripts/us-site-14.test.mjs checks the README and GitHub's issue template,
 * which have to spell the addresses out.
 */
export const SPINE_DOMAIN = "h4loom.com";
export const SPINE_SITE_URL = `https://spine.${SPINE_DOMAIN}/`;
export const SPINE_DOCS_URL = `${SPINE_SITE_URL}docs/`;
