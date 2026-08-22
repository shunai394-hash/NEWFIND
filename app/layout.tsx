import type { Metadata } from "next";
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
  description: "商品を発見するSNS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-neutral-200 font-sans text-neutral-900">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
