import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/toaster";

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
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
