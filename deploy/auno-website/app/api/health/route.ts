import { db,connection,assertDevnet } from '@/lib/payments/server';
export async function GET(){let database='unavailable',rpc='unavailable';try{await db().prepare('SELECT id FROM payments LIMIT 1').first();database='available';}catch{console.error(JSON.stringify({event:'health_database_unavailable'}));}try{await assertDevnet(connection());rpc='available';}catch{console.error(JSON.stringify({event:'health_rpc_unavailable'}));}return Response.json({network:'devnet',database,rpc,payments:'developer-preview',mainnet:false},{status:database==='available'&&rpc==='available'?200:503,headers:{'Cache-Control':'no-store'}});}


