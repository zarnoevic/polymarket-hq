import { ToasterClient } from "../components/ToasterClient";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ToasterClient />
      <main className="flex-1">{children}</main>
    </>
  );
}
