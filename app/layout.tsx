import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "PrePay",
  description: "Deposit PreStocks, mint pUSD, and spend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-black`}
      >
        <Providers>
          <main className="pb-16 min-h-screen">
            {children}
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
