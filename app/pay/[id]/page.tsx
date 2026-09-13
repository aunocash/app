import { Footer, Navbar } from "@/components/site-shell";
import { LiveCheckout } from "@/components/live-checkout";
import { LiveDemoLauncher } from "@/components/live-demo-launcher";
import { ProductQueryProvider } from "@/components/product-query-provider";
import { WalletProvider } from "@/components/wallet-provider";

export const metadata = { title: "Devnet checkout", robots: { index: false, follow: false } };
export default async function Checkout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><Navbar /><main id="main-content" className="container page-main"><ProductQueryProvider><WalletProvider>{id === "demo" ? <LiveDemoLauncher /> : <LiveCheckout key={id} paymentId={id} />}</WalletProvider></ProductQueryProvider></main><Footer /></>;
}