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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://newfind-self.vercel.app"),
  title: {
    default: "NEWFIND｜商品・トレンド発見コミュニティ",
    template: "%s｜NEWFIND",
  },
  description: "ファッション・美容・ガジェットなど、気になる商品やトレンドを発見。情報源を確認して、安心して公式ショップへ。",
  applicationName: "NEWFIND",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "NEWFIND",
    title: "NEWFIND｜商品・トレンド発見コミュニティ",
    description: "ファッション・美容・ガジェットなど、気になる商品やトレンドを発見。情報源を確認して、安心して公式ショップへ。",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEWFIND｜商品・トレンド発見コミュニティ",
    description: "ファッション・美容・ガジェットなど、気になる商品やトレンドを発見。情報源を確認して、安心して公式ショップへ。",
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
