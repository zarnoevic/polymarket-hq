import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Polymarket HQ",
  description: "Private dashboard for Polymarket market analysis and insights",
  icons: {
    icon: "/logo.svg",
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
        {children}
      </body>
    </html>
  );
}
