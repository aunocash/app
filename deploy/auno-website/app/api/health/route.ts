import { assertNetwork, connection, db, mainnetEnabled, mainnetSplitsEnabled, paymentNetwork } from '@/lib/payments/server';

export async function GET() {
  let database = 'unavailable', rpc = 'unavailable';
  let network = 'unavailable';
  try { network = paymentNetwork(); await db().prepare('SELECT id FROM payments LIMIT 1').first(); database = 'available'; }
  catch { console.error(JSON.stringify({ event: 'health_database_unavailable' })); }
  try { await assertNetwork(connection()); rpc = 'available'; }
  catch { console.error(JSON.stringify({ event: 'health_rpc_unavailable' })); }
  return Response.json({ network, database, rpc, payments: network === 'mainnet-beta' ? (mainnetEnabled() ? 'mainnet-beta-enabled' : 'mainnet-beta-disabled') : 'developer-preview', mainnet: network === 'mainnet-beta', mainnetSplits: network === 'mainnet-beta' ? (mainnetSplitsEnabled() ? 'enabled' : 'disabled') : 'not-applicable' }, { status: database === 'available' && rpc === 'available' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}

