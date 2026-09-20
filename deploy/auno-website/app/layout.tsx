import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ClientRuntimeGuard } from "./client-runtime-guard";
import { NetworkProvider } from './network-context';
import { isMainnetRequest } from '@/lib/site-network';
import "./globals.css";

export const metadata: Metadata = {
  title: "AUNO — Programmable Payments on Solana",
  description: "Payment links, split payments and verified receipts on Solana Mainnet.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/auno-logo.png",
    shortcut: "/auno-logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const network = await isMainnetRequest() ? 'mainnet-beta' : 'devnet';
  return (
    <html lang="en" className="dark" data-theme="dark" data-network={network}>
      <body className="antialiased">
        <ClientRuntimeGuard />
        <NetworkProvider network={network}>{children}</NetworkProvider>
        <Toaster />
      </body>
    </html>
  );
}
