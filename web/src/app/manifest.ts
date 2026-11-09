import type { MetadataRoute } from "next";

// Lets patients add Nutrix to their home screen (needed for reminders on iPhone).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nutrix",
    short_name: "Nutrix",
    description: "Your meal plan and progress, from your dietitian.",
    start_url: "/patient",
    scope: "/",
    display: "standalone",
    background_color: "#f4f5f2",
    theme_color: "#0d1117",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
