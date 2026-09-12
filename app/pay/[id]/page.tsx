import { notFound } from "next/navigation";
import { Navbar, Footer } from "@/components/site-shell";
import { CheckoutCard } from "@/components/checkout-card";
import { decodePayment, DEMO_PAYMENT } from "@/lib/payments";
export const metadata = {
  title: "Demo checkout",
  robots: { index: false, follow: false },
};
export default async function Checkout({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payment = id === "demo" ? DEMO_PAYMENT : decodePayment(id);
  if (!payment) notFound();
  return (
    <>
      <Navbar />
      <main id="main-content" className="container page-main">
        <CheckoutCard payment={payment} sample={id === "demo"} id={id} />
      </main>
      <Footer />
    </>
  );
}
