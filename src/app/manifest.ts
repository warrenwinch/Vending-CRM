import type { MetadataRoute } from "next";

// Lets phones add the app to the home screen with the Watwin icon and open it
// full screen, without the browser's address bar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Watwin Vending CRM",
    short_name: "Watwin CRM",
    description: "Customers, sites, machines and faults for Watwin Vending",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#2f2e2c",
    theme_color: "#2f2e2c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
