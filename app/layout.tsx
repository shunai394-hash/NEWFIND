import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { AppProvider } from "@/lib/app-context";
import { SignupConsentGate } from "@/components/signup-consent-gate";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://newfind-self.vercel.app";
const siteTitle = "NEWFIND｜商品・トレンド発見コミュニティ";
const siteDescription =
  "ファッション・美容・ガジェットなど、気になる商品やトレンドを発見。情報源を確認して、安心して公式ショップへ。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s｜NEWFIND",
  },
  description: siteDescription,
  applicationName: "NEWFIND",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "NEWFIND",
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  icons: {
    icon: [
      { url: "/brand/app-icon.svg", type: "image/svg+xml" },
      { url: "/brand/icon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geist.variable} antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-black font-sans text-white"
        suppressHydrationWarning
      >
        <AppProvider>
          <SignupConsentGate />
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
