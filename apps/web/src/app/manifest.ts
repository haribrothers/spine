import type { MetadataRoute } from "next";

/**
 * US-SET-26 (D-206) — the icons a phone or browser uses when someone adds
 * Spine to their home screen. Spine stays a normal website: `display:
 * "browser"`, no install prompt (public/sw.js only handles push).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spine",
    short_name: "Spine",
    start_url: "/",
    display: "browser",
    background_color: "#F7F6F3",
    theme_color: "#F7F6F3",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
