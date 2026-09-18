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
    <html lang="en" className="light" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try { const theme = localStorage.getItem('auno-theme'); if (theme === 'light' || theme === 'dark') { document.documentElement.dataset.theme = theme; document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(theme); } } catch {}" }} />
      </head>
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
