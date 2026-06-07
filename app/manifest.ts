import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Feefee",
    short_name: "Feefee",
    description:
      "Share one browser tab's audio with friends by QR code.",
    start_url: "/",
    display: "standalone",
    background_color: "#10100d",
    theme_color: "#c2ad78",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
