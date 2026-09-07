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
  title: "Pehchaan",
  description: "Student, attendance and parent-teacher management for Pehchaan centres",
  manifest: "/manifest.webmanifest",
  // iPhone and iPad do not read the web manifest for the home-screen icon. Without
  // an apple-touch-icon they screenshot the page and use that, which is why the
  // installed app looked like a picture of a login form rather than Pehchaan.
  icons: {
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/icons/apple-touch-icon-167.png", sizes: "167x167" },
    ],
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  appleWebApp: { capable: true, title: "Pehchaan", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // the same navy the manifest and the Android app use; they had drifted apart
  themeColor: "#0e2a47",
  // let the app draw under the notch once it is on the home screen
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${literata.variable}`}>{children}</body>
    </html>
  );
}
