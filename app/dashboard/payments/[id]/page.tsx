import { PaymentDetail } from "@/components/payment-detail";

export const metadata = { title: "Payment details" };

export default async function PaymentDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentDetail paymentId={id} />;
}
