import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { AppProvider } from "@/lib/app-context";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NEWFIND",
  description: "今、日本で見つかっている商品を発見する。出典を確認し、購入先まで進める。",
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
      className={`${geist.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-neutral-200 font-sans text-neutral-900"
        suppressHydrationWarning
      >
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
