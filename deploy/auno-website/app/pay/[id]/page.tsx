import { Checkout } from "../../payment-ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Checkout id={(await params).id} />;
}
