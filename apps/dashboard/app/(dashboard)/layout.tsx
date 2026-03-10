import { Nav } from "../components/Nav";
import { ToasterClient } from "../components/ToasterClient";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ToasterClient />
      <Nav />
      <main className="flex-1">{children}</main>
    </>
  );
}
