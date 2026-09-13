import { PaymentCreateScreen } from "@/components/payment-create-screen";
export const metadata = { title: "Create a payment" };
export default async function Create({ searchParams }: { searchParams: Promise<{ mode?: string }> }) { const { mode } = await searchParams; return <PaymentCreateScreen initialSplit={mode === "split"} />; }