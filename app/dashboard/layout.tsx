import { Info } from "lucide-react";

import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import { DashboardNav } from "@/components/dashboard-nav";
import { ProductQueryProvider } from "@/components/product-query-provider";
import { Footer, Navbar } from "@/components/site-shell";
import { WalletProvider } from "@/components/wallet-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <><Navbar /><ProductQueryProvider><WalletProvider><main id="main-content" className="container page-main"><div className="page-intro"><div className="eyebrow">YOUR PAYMENTS. YOUR RULES.</div><h1>Your payment workspace.</h1><p>Create a request, share a link, and follow verified settlement.</p></div><div className="notice"><Info size={16} /><span>Devnet only. Payments settle directly from the payer wallet and are verified after Solana finalization.</span></div><DashboardAuthGate><DashboardNav />{children}</DashboardAuthGate></main></WalletProvider></ProductQueryProvider><Footer /></>;
}