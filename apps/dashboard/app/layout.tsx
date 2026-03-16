import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { WealthTabsNav } from "./components/WealthTabsNav";
import { ToasterClient } from "./components/ToasterClient";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wealth HQ",
  description: "Wealth dashboard: Polymarket, stocks, gold, and FX insights",
  icons: {
    icon: "/logo-diamond.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${dmSans.variable}`} suppressHydrationWarning>
      <body className="antialiased flex min-h-screen flex-col font-sans">
        <ToasterClient />
        <WealthTabsNav />
        {children}
      </body>
    </html>
  );
}
