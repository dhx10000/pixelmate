import type { Metadata, Viewport } from "next";
import { Instrument_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

// ── Site constants ─────────────────────────────────────────────────────────

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pixelmate.pixelsite.ai";
const TITLE = "PixelMate — AI Business Analyst by PIXEL";
const DESCRIPTION =
  "Describe your business challenge. PixelMate will ask a few simple questions, review your materials, and prepare a clear brief for the PIXEL team.";

// ── SEO metadata ───────────────────────────────────────────────────────────

export const metadata: Metadata = {
  // Title
  title: TITLE,
  description: DESCRIPTION,

  // Resolve relative image and URL references against the production origin.
  // Required for openGraph.images and twitter.images to render correct absolute URLs.
  metadataBase: new URL(SITE_URL),

  // Canonical
  alternates: {
    canonical: "/",
  },

  // Open Graph
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "/",
    siteName: "PixelMate",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: TITLE,
      },
    ],
  },

  // Twitter / X card
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },

  // Icons — static files in public/ plus the programmatic icon in src/app/
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
  },
};

// ── Viewport ───────────────────────────────────────────────────────────────

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

// ── Root layout ────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
