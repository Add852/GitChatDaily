import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GitChat Journal",
    short_name: "GitChat",
    description:
      "Conversational journaling that turns AI-guided reflections into private GitHub commits.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1117",
    theme_color: "#238636",
    lang: "en",
    icons: [
      {
        src: "/icons/app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

