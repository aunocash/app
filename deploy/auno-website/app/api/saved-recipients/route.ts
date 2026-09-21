import { handled, savedRecipientsRequest } from '@/lib/payments/server';
export async function POST(request: Request) { return handled(() => savedRecipientsRequest(request)); }
