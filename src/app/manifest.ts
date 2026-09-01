import type { MetadataRoute } from "next";

/** Served at /manifest.webmanifest — also what the Android TWA wrapper is built from. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FreePathshala CMS",
    short_name: "FreePathshala",
    description:
      "Students, attendance, timetable, teaching plans and parent meetings for FreePathshala centres.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f6fa",
    theme_color: "#2f36a3",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mark attendance", url: "/attendance" },
      { name: "My check-in", url: "/my-attendance" },
      { name: "Record PTM", url: "/ptm/new" },
    ],
  };
}
