import { PublicSplitReceipt } from "../../payment-ui";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  return <PublicSplitReceipt id={(await params).id} />;
}
