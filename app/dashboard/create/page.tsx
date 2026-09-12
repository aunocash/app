import { PaymentCreator } from "@/components/payment-creator";
import { PaymentCard } from "@/components/payment-card";
export const metadata = { title: "Create a payment" };
export default async function Create({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return (
    <div className="app-grid">
      <PaymentCreator initialSplit={mode === "split"} />
      <aside className="preview-aside">
        <div className="eyebrow">A FAMILIAR WAY TO GET PAID</div>
        <PaymentCard />
        <p>Example checkout. Your request will use the details you enter.</p>
      </aside>
    </div>
  );
}
