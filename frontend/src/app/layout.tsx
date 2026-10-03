import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MemoryDesk — Incident Intelligence",
  description: "AI Software Incident Response Agent with Active Organizational Memory",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#fef9ed] text-[#5d524b] antialiased selection:bg-[#fbd3be] selection:text-[#2e4d4d] min-h-screen">
        {children}
      </body>
    </html>
  );
}
