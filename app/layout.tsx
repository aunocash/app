import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./product.css";
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
export const metadata: Metadata = {
  title: { default: "AUNO — Programmable Payments on Solana", template: "%s | AUNO" },
  description: "Create Solana devnet payment links for SOL and USDC with verified, wallet-to-wallet settlement.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable}`}><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>;
}