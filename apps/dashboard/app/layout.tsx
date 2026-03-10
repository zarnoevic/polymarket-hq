import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polymarket HQ",
  description: "Private dashboard for Polymarket market analysis and insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased flex min-h-screen flex-col">
        <Toaster richColors position="top-right" />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
