import { PolymarketNav } from "../components/PolymarketNav";
import { ToasterClient } from "../components/ToasterClient";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ToasterClient />
      <PolymarketNav />
      <main className="flex-1">{children}</main>
    </>
  );
}
