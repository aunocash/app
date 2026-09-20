import { handled, repeatSplitsRequest } from '@/lib/payments/server';
export async function POST(request: Request) { return handled(() => repeatSplitsRequest(request)); }
