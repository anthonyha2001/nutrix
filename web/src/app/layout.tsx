import type { Metadata, Viewport } from "next";
import { Geist, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/toaster";

// Arabic letters (the patient app in Arabic). Geist has none; loaded only when used.
const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Nutrix", template: "%s · Nutrix" },
  description: "The operating system for dietitians.",
  appleWebApp: { capable: true, title: "Nutrix", statusBarStyle: "default" },
  icons: { icon: { url: "/icon.svg", type: "image/svg+xml" } },
};

export const viewport: Viewport = { themeColor: "#0d1117", viewportFit: "cover", maximumScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${arabic.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
