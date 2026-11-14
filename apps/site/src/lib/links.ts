/**
 * US-SITE-02 — where the home page's links go. Docs paths are relative to the
 * site (no domain, D-273); scripts/site/build-pages.mjs fails the build when
 * one of them wasn't built.
 */
export const REPO_URL = "https://github.com/haribrothers/spine";
export const LICENCE_URL = `${REPO_URL}/blob/main/LICENSE`;

export const docs = {
  home: "/docs/",
  install: "/docs/get-started/install/",
  guide: "/docs/guide/",
  selfHosting: "/docs/self-hosting/install/",
  architecture: "/docs/developers/architecture/",
  api: "/docs/api/",
  versions: "/docs/versions/",
} as const;
