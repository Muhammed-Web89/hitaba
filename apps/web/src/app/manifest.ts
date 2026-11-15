import type { MetadataRoute } from "next";

/** Android uygulaması (Trusted Web Activity) ve "ana ekrana ekle" için. twa=1: Play sürümü olduğunu siteye bildirir. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Hitaba",
    short_name: "Hitaba",
    description:
      "Nikoh niyatidagi halol tanishuv · Халяльное знакомство для никаха",
    start_url: "/app?twa=1",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBFAF6",
    theme_color: "#060a0e",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
