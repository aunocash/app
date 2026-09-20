import InvoicePublic from "../invoice-public";
export default async function Page({ params }: { params: Promise<{ publicId: string }> }) { return <InvoicePublic publicId={(await params).publicId} />; }
