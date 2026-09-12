import { Navbar, Footer } from "@/components/site-shell";
import { DashboardNav } from "@/components/dashboard-nav";
import { Info } from "lucide-react";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main id="main-content" className="container page-main">
        <div className="page-intro">
          <div className="eyebrow">YOUR PAYMENTS. YOUR RULES.</div>
          <h1>Your payment workspace.</h1>
          <p>Create a request, share a link, and follow the flow.</p>
        </div>
        <div className="notice">
          <Info size={16} />
          <span>
            Product preview. Requests and history are stored in this browser.
            Checkout is simulated; real Solana settlement is not connected.
          </span>
        </div>
        <DashboardNav />
        {children}
      </main>
      <Footer />
    </>
  );
}
