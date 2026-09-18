import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "AUNO — Programmable Payments on Solana",
  description: "Payment links and programmable payment flows on Solana devnet.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/auno-tab-icon.svg",
    shortcut: "/auno-tab-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
