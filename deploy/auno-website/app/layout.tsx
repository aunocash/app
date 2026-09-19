import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ClientRuntimeGuard } from "./client-runtime-guard";
import "./globals.css";

export const metadata: Metadata = {
  title: "AUNO — Programmable Payments on Solana",
  description: "Payment links and programmable payment flows on Solana devnet.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/auno-logo.png",
    shortcut: "/auno-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-theme="dark">
      <body className="antialiased">
        <ClientRuntimeGuard />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
