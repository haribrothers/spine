import type { MetadataRoute } from "next";

/**
 * US-SET-26 (D-206) — the icons a phone or browser uses when someone adds
 * Spine to their home screen. US-OPS-55 (D-283): opened from there it's an
 * app — `display: "standalone"` (no address bar or toolbar), starting at the
 * dashboard. The colours are tokens.json's light `background` (the dark one
 * is in layout.tsx's themeColor, as a manifest has one). No install prompt
 * and no offline use: public/sw.js only handles push.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Spine",
    short_name: "Spine",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F7F6F3",
    theme_color: "#F7F6F3",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
