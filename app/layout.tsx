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
    default: "NEWFIND｜レディースファッション・コスメ・新商品発見",
    template: "%s｜NEWFIND",
  },
  description: "ファッション・コスメ・スニーカー・ガジェットなどの新商品やトレンドを発見。気になる商品の情報源や公式販売先を確認できます。",
  applicationName: "NEWFIND",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "NEWFIND",
    title: "NEWFIND｜レディースファッション・コスメ・新商品発見",
    description: "ファッション・コスメ・スニーカー・ガジェットなどの新商品やトレンドを発見。気になる商品の情報源や公式販売先を確認できます。",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEWFIND｜レディースファッション・コスメ・新商品発見",
    description: "ファッション・コスメ・スニーカー・ガジェットなどの新商品やトレンドを発見。気になる商品の情報源や公式販売先を確認できます。",
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
