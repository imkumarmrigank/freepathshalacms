import type { Metadata, Viewport } from "next";
import { Geist, Literata } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// the handbook reads as a document rather than a screen, and a serif carries
// that; nothing else in the app uses it
const literata = Literata({
  variable: "--font-literata", subsets: ["latin"], weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FreePathshala CMS",
  description: "Student, attendance and parent-teacher management for FreePathshala centres",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "FreePathshala", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // paints the Android status bar in the brand colour inside the app shell
  themeColor: "#2f36a3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${literata.variable}`}>{children}</body>
    </html>
  );
}
