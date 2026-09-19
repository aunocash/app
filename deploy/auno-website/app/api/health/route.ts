import { assertNetwork, connection, db, paymentNetwork } from '@/lib/payments/server';

export async function GET() {
  let database = 'unavailable', rpc = 'unavailable';
  let network = 'unavailable';
  try { network = paymentNetwork(); await db().prepare('SELECT id FROM payments LIMIT 1').first(); database = 'available'; }
  catch { console.error(JSON.stringify({ event: 'health_database_unavailable' })); }
  try { await assertNetwork(connection()); rpc = 'available'; }
  catch { console.error(JSON.stringify({ event: 'health_rpc_unavailable' })); }
  return Response.json({ network, database, rpc, payments: network === 'mainnet-beta' ? 'mainnet-beta-disabled-by-default' : 'developer-preview', mainnet: network === 'mainnet-beta' }, { status: database === 'available' && rpc === 'available' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}

