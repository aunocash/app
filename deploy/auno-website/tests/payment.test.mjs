import assert from 'node:assert/strict';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
mkdirSync('work',{recursive:true});
async function build(options){let source=readFileSync(options.entryPoints[0],'utf8');source=source.replace("import { env } from 'cloudflare:workers';",'const env = globalThis.__AUNO_ENV__;').replace("from './model'","from './model.mjs'").replace("from './policy'","from './policy.mjs'");writeFileSync(options.outfile,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);}
import { ComputeBudgetProgram,Keypair,Connection,Transaction,TransactionInstruction,TransactionMessage,VersionedTransaction,PublicKey,SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
await build({entryPoints:['lib/payments/model.ts'],outfile:'work/model.mjs',bundle:true,platform:'node',format:'esm'});
const model=await import('../work/model.mjs');
let passed=0;
function check(name,fn){fn();console.log('PASS',name);passed++}
check('SOL and USDC precision',()=>{assert.equal(model.toBaseUnits('0.000000001',9),1n);assert.equal(model.toBaseUnits('100.000001',6),100000001n);assert.equal(model.displayUnits(100000000n,6),'100')});
check('Mainnet genesis hash is complete',()=>{assert.equal(model.NETWORKS['mainnet-beta'].genesisHash,'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')});
check('Reject unsafe decimal input',()=>{for(const x of ['1e3','-1','0','NaN','1.0000001','9007199254740992'])assert.throws(()=>model.toBaseUnits(x,6));});
check('Split rounding conserves base units',()=>{assert.deepEqual(model.allocate(101n,[8000,1500,500]),[81n,15n,5n]);assert.throws(()=>model.allocate(1n,[5000,5000]));assert.throws(()=>model.allocate(100n,[5000,4900]));});
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync('drizzle/0000_lush_the_executioner.sql','utf8'));sqlite.exec(readFileSync('drizzle/0001_secure_atomic_split.sql','utf8'));sqlite.exec(readFileSync('drizzle/0002_mainnet_beta.sql','utf8'));
check('Database rejects invalid recipient allocations',()=>{assert.throws(()=>sqlite.prepare('INSERT INTO payments (id,merchant_wallet,title,description,asset,amount,amount_base_units,recipients,reference,expires_at,status,created_at,updated_at,creation_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('invalid','merchant','Invalid','', 'SOL','1','100',JSON.stringify([{position:0,label:'Zero',address:'wallet',percentageBps:10000,amountBaseUnits:'0'}]),'',Date.now()+3600000,'ACTIVE',Date.now(),Date.now(),'invalid'));});
function statement(sql,args=[]){return {bind(...v){return statement(sql,v)},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:result.changes}}}}};
globalThis.__AUNO_ENV__={DB:{prepare:statement,async batch(stmts){sqlite.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}}};
await build({entryPoints:['lib/payments/server.ts'],outfile:'work/server-test.mjs',bundle:true,packages:'external',platform:'node',format:'esm',plugins:[{name:'test-env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'test-env',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env=globalThis.__AUNO_ENV__;',loader:'js'}))}}]});
await build({entryPoints:['lib/payments/policy.ts'],outfile:'work/policy.mjs',bundle:true,platform:'node',format:'esm'});
const server=await import('../work/server-test.mjs');
check('auno.cash origin allowlist',()=>{assert.doesNotThrow(()=>server.sameOrigin(new Request('https://auno.cash/api/payments',{headers:{origin:'https://auno.cash'}})));assert.throws(()=>server.sameOrigin(new Request('https://auno.cash/api/payments',{headers:{origin:'https://www.auno.cash'}})));assert.throws(()=>server.sameOrigin(new Request('https://auno.cash/api/payments',{headers:{origin:'https://evil.example'}})));assert.doesNotThrow(()=>server.sameOrigin(new Request('http://localhost:5173/api/payments',{headers:{origin:'http://localhost:5173'}})))});
const merchant=Keypair.generate(),payer=Keypair.generate();
check('Split recipients require unique valid wallets and a complete allocation',()=>{
  const affiliate=Keypair.generate().publicKey.toBase58();
  const treasury=Keypair.generate().publicKey.toBase58();
  assert.deepEqual(model.validateSplitRecipients([
    {label:'Merchant',wallet:merchant.publicKey.toBase58(),bps:8000},
    {label:'Affiliate',wallet:affiliate,bps:1500},
    {label:'Treasury',wallet:treasury,bps:500},
  ]),[
    {label:'Merchant',wallet:merchant.publicKey.toBase58(),bps:8000},
    {label:'Affiliate',wallet:affiliate,bps:1500},
    {label:'Treasury',wallet:treasury,bps:500},
  ]);
  assert.throws(()=>model.validateSplitRecipients([
    {label:'Merchant',wallet:merchant.publicKey.toBase58(),bps:5000},
    {label:'Duplicate',wallet:merchant.publicKey.toBase58(),bps:5000},
  ]));
  assert.throws(()=>model.validateSplitRecipients([
    {label:'Merchant',wallet:merchant.publicKey.toBase58(),bps:10000},
  ]));
  assert.throws(()=>model.validateSplitRecipients([
    {label:'Merchant',wallet:'not-a-solana-wallet',bps:5000},
    {label:'Affiliate',wallet:affiliate,bps:5000},
  ]));
});
check('Split percentages convert to exact basis points',()=>{
  assert.equal(model.percentToBps('80'),8000);
  assert.equal(model.percentToBps('15.25'),1525);
  assert.throws(()=>model.percentToBps('1e2'));
  assert.throws(()=>model.percentToBps('100.001'));
});
const origin='http://localhost:5173';
const payload=JSON.stringify({merchantWallet:merchant.publicKey.toBase58(),title:'Controlled integration test',description:'Test record',asset:'SOL',amount:'0.001',recipient:merchant.publicKey.toBase58(),reference:'TEST',expiresAt:Date.now()+3600000,timestamp:Date.now(),origin});
const sig=bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(payload)),merchant.secretKey));
const request=body=>new Request(origin+'/api/payments',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const p=await server.createPayment(request({payload,signature:sig}));assert.equal(p.status,'ACTIVE');assert.equal((await server.createPayment(request({payload,signature:sig}))).id,p.id);passed++;console.log('PASS signed creation, persistence, duplicate creation');
await assert.rejects(()=>server.createPayment(request({payload:payload.replace('0.001','0.002'),signature:sig})));passed++;console.log('PASS forged merchant data rejected');
check('Address validation',()=>{assert.equal(server.address(merchant.publicKey.toBase58()),merchant.publicKey.toBase58());assert.throws(()=>server.address('fake-wallet'))});
let payerBalance=10_000_000_000;Connection.prototype.getGenesisHash=async()=> 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';Connection.prototype.getLatestBlockhash=async()=>({blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:2_000_000_000});Connection.prototype.getFeeForMessage=async()=>({value:5_000});Connection.prototype.getBalance=async()=>payerBalance;Connection.prototype.getBlockHeight=async()=>100;Connection.prototype.sendRawTransaction=async bytes=>{try{return bs58.encode(Transaction.from(bytes).signature)}catch{return bs58.encode(VersionedTransaction.deserialize(bytes).signatures[0])}};
check('Relay failures provide safe actionable reasons',()=>{assert.match(server.relayFailureMessage(new Error('Transaction results in an account with insufficient funds for rent')),/rent-exempt minimum/);assert.match(server.relayFailureMessage(new Error('blockhash not found')),/expired/);assert.match(server.relayFailureMessage(new Error('unknown upstream error')),/did not acknowledge/);});
await assert.rejects(() => server.preparePayment(request({ payer: merchant.publicKey.toBase58() }), p.id), error => error.status === 400 && /Payer and recipient/.test(error.message));passed++;console.log('PASS payer-recipient self-payment is rejected before preparation');
payerBalance=1_000_000;await assert.rejects(()=>server.preparePayment(request({payer:payer.publicKey.toBase58()}),p.id),error=>error.status===422&&/including network fees/.test(error.message));payerBalance=10_000_000_000;const prepared=await server.preparePayment(request({payer:payer.publicKey.toBase58()}),p.id);const transaction=Transaction.from(Buffer.from(prepared.transaction,'base64'));transaction.sign(payer);const refreshed=Transaction.from(Buffer.from(prepared.transaction,'base64'));refreshed.recentBlockhash=Keypair.generate().publicKey.toBase58();refreshed.sign(payer);const walletAdjusted=Transaction.from(Buffer.from(prepared.transaction,'base64'));const loadedAccountsLimit=new TransactionInstruction({programId:ComputeBudgetProgram.programId,keys:[],data:Buffer.from([4,0,0,0,4])});walletAdjusted.instructions.unshift(loadedAccountsLimit,ComputeBudgetProgram.requestHeapFrame({bytes:32*1024}),ComputeBudgetProgram.setComputeUnitPrice({microLamports:10_000}),ComputeBudgetProgram.setComputeUnitLimit({units:200_000}));walletAdjusted.sign(payer);const versionedPrepared=await server.preparePayment(request({payer:payer.publicKey.toBase58()}),p.id);const versionedSource=Transaction.from(Buffer.from(versionedPrepared.transaction,"base64"));const versioned=new VersionedTransaction(new TransactionMessage({payerKey:payer.publicKey,recentBlockhash:versionedSource.recentBlockhash,instructions:versionedSource.instructions}).compileToV0Message());versioned.sign([payer]);const versionedSubmitted=await server.submitPayment(request({attemptId:versionedPrepared.attemptId,attemptToken:versionedPrepared.attemptToken,transaction:Buffer.from(versioned.serialize()).toString("base64")}),p.id);assert.equal(versionedSubmitted.status,"SUBMITTED");
const parallel=await server.preparePayment(request({payer:Keypair.generate().publicKey.toBase58()}),p.id);assert.notEqual(parallel.attemptId,prepared.attemptId);assert.equal((await server.getPayment(p.id)).status,'ACTIVE');const tampered=Transaction.from(Buffer.from(prepared.transaction,'base64'));tampered.add(SystemProgram.transfer({fromPubkey:payer.publicKey,toPubkey:Keypair.generate().publicKey,lamports:1}));tampered.sign(payer);await assert.rejects(()=>server.submitPayment(request({attemptId:prepared.attemptId,attemptToken:prepared.attemptToken,transaction:tampered.serialize().toString('base64')}),p.id),error=>error.status===422);const unsafe=Transaction.from(Buffer.from(prepared.transaction,'base64'));unsafe.instructions.unshift(ComputeBudgetProgram.setComputeUnitPrice({microLamports:100_000_000}));unsafe.sign(payer);await assert.rejects(()=>server.submitPayment(request({attemptId:prepared.attemptId,attemptToken:prepared.attemptToken,transaction:unsafe.serialize().toString('base64')}),p.id),error=>error.status===422&&/priority fee/.test(error.message));await assert.rejects(()=>server.submitPayment(request({attemptId:prepared.attemptId,attemptToken:'0'.repeat(64),transaction:transaction.serialize().toString('base64')}),p.id));const submitted=await server.submitPayment(request({attemptId:prepared.attemptId,attemptToken:prepared.attemptToken,transaction:walletAdjusted.serialize().toString('base64')}),p.id);assert.equal(submitted.status,'SUBMITTED');passed++;console.log('PASS wallet compute budget, refreshed blockhash, and exact signed submission');
const memo=`auno:${p.id}:${prepared.attemptId}`;
let wrong=false,failed=false;
Connection.prototype.getParsedTransaction=async()=>({blockTime:Math.floor(Date.now()/1000),meta:{err:failed?{InstructionError:[0,'failed']}:null},transaction:{message:{accountKeys:[{pubkey:payer.publicKey,signer:true},{pubkey:merchant.publicKey,signer:false}],instructions:[{programId:ComputeBudgetProgram.programId,parsed:{type:'setLoadedAccountsDataSizeLimit',info:{accountDataSizeLimitBytes:1024}}},{programId:ComputeBudgetProgram.programId,parsed:{type:'requestHeapFrame',info:{bytes:32768}}},{programId:ComputeBudgetProgram.programId,parsed:{type:'setComputeUnitPrice',info:{microLamports:'10000'}}},{programId:ComputeBudgetProgram.programId,parsed:{type:'setComputeUnitLimit',info:{units:200000}}},{programId:SystemProgram.programId,parsed:{type:'transfer',info:{source:payer.publicKey.toBase58(),destination:wrong?Keypair.generate().publicKey.toBase58():merchant.publicKey.toBase58(),lamports:1000000}}},{programId:new PublicKey(model.MEMO_PROGRAM),parsed:memo}]}}});Connection.prototype.getTransaction=async()=>({transaction:{message:walletAdjusted.compileMessage(),signatures:walletAdjusted.signatures.map(signature=>signature.signature?bs58.encode(signature.signature):'')}});
wrong=true;await assert.rejects(()=>server.verifyPayment(p.id,prepared.attemptId,prepared.attemptToken));assert.notEqual((await server.getPayment(p.id)).status,'PAID');wrong=false;failed=true;await assert.rejects(()=>server.verifyPayment(p.id,prepared.attemptId,prepared.attemptToken));failed=false;passed++;console.log('PASS wrong recipient and failed transaction cannot become PAID');
const paid=await server.verifyPayment(p.id,prepared.attemptId,prepared.attemptToken);assert.equal(paid.status,'PAID');assert.equal((await server.verifyPayment(p.id,prepared.attemptId,prepared.attemptToken)).transactionSignature,submitted.signature);await assert.rejects(()=>server.verifyPayment(p.id,prepared.attemptId,'0'.repeat(64)));passed++;console.log('PASS verified receipt, duplicate verification and attempt-secret protection');
const missingPayload=payload.replace('TEST','MISSING');const missingSig=bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(missingPayload)),merchant.secretKey));const missing=await server.createPayment(request({payload:missingPayload,signature:missingSig}));const missingPrepared=await server.preparePayment(request({payer:payer.publicKey.toBase58()}),missing.id);const missingTransaction=Transaction.from(Buffer.from(missingPrepared.transaction,'base64'));missingTransaction.sign(payer);await server.submitPayment(request({attemptId:missingPrepared.attemptId,attemptToken:missingPrepared.attemptToken,transaction:missingTransaction.serialize().toString('base64')}),missing.id);Connection.prototype.getParsedTransaction=async()=>null;Connection.prototype.getSignatureStatus=async()=>({value:null});assert.equal((await server.verifyPayment(missing.id,missingPrepared.attemptId,missingPrepared.attemptToken)).status,'CONFIRMING');passed++;console.log('PASS missing signature remains attempt-local while confirming');
const expired=await server.getPayment(p.id);assert.equal(expired.status,'PAID');sqlite.prepare("UPDATE payments SET status='ACTIVE',expires_at=? WHERE id=?").run(Date.now()-1000,p.id);assert.equal((await server.getPayment(p.id)).status,'EXPIRED');await assert.rejects(()=>server.preparePayment(request({payer:payer.publicKey.toBase58()}),p.id));passed++;console.log('PASS expiration blocks payment preparation');
console.log(`${passed} test groups passed. RPC fixtures are controlled; these are not real devnet transactions.`);


Object.assign(globalThis.__AUNO_ENV__, { AUNO_DEVNET_SPLITS_ENABLED: 'false', AUNO_VERIFIER_TOKEN: '' });
const splitA = Keypair.generate(), splitB = Keypair.generate(), splitC = Keypair.generate(), splitD = Keypair.generate(), splitE = Keypair.generate();
const splitInput = { ...JSON.parse(payload), title: 'Devnet SOL split', amount: '0.01', recipients: [
  { label: 'Alice', wallet: splitA.publicKey.toBase58(), bps: 5_000 },
  { label: 'Bob', wallet: splitB.publicKey.toBase58(), bps: 5_000 },
], timestamp: Date.now() };
const disabledSplitPayload = JSON.stringify(splitInput);
const disabledSplitSignature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(disabledSplitPayload)), merchant.secretKey));
await assert.rejects(() => server.createPayment(request({ payload: disabledSplitPayload, signature: disabledSplitSignature })), error => error.status === 503);
Object.assign(globalThis.__AUNO_ENV__, { AUNO_DEVNET_SPLITS_ENABLED: 'true', AUNO_VERIFIER_TOKEN: 'd'.repeat(32) });
const splitPayload = JSON.stringify({ ...splitInput, timestamp: Date.now() });
const splitSignature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(splitPayload)), merchant.secretKey));
const split = await server.createPayment(request({ payload: splitPayload, signature: splitSignature }));
await assert.rejects(() => server.publicSplitReceipt(split.id), error => error.status === 404);
const splitPrepared = await server.preparePayment(request({ payer: payer.publicKey.toBase58() }), split.id);
const splitTransaction = Transaction.from(Buffer.from(splitPrepared.transaction, 'base64'));
splitTransaction.sign(payer);
await server.submitPayment(request({ attemptId: splitPrepared.attemptId, attemptToken: splitPrepared.attemptToken, transaction: splitTransaction.serialize().toString('base64') }), split.id);
Connection.prototype.getParsedTransaction = async () => ({ blockTime: Math.floor(Date.now() / 1000), meta: { err: null }, transaction: { message: { accountKeys: [{ pubkey: payer.publicKey, signer: true }, { pubkey: splitA.publicKey, signer: false }, { pubkey: splitB.publicKey, signer: false }], instructions: [
  { programId: SystemProgram.programId, parsed: { type: 'transfer', info: { source: payer.publicKey.toBase58(), destination: splitA.publicKey.toBase58(), lamports: 5_000_000 } } },
  { programId: SystemProgram.programId, parsed: { type: 'transfer', info: { source: payer.publicKey.toBase58(), destination: splitB.publicKey.toBase58(), lamports: 5_000_000 } } },
  { programId: new PublicKey(model.MEMO_PROGRAM), parsed: `auno:${split.id}:${splitPrepared.attemptId}` },
] } } });
Connection.prototype.getTransaction = async () => ({ transaction: { message: splitTransaction.compileMessage(), signatures: splitTransaction.signatures.map((signature) => signature.signature ? bs58.encode(signature.signature) : '') } });
const splitReceipt = await server.verifyPayment(split.id, splitPrepared.attemptId, splitPrepared.attemptToken);
assert.equal(splitReceipt.status, 'PAID');
assert.equal((await server.publicSplitReceipt(split.id)).transactionSignature, splitReceipt.transactionSignature);
await assert.rejects(() => server.publicSplitReceipt(p.id), error => error.status === 404);
const fiveSplitPayload = JSON.stringify({ ...splitInput, title: 'Five way split', recipients: [
  { label: 'Alice', wallet: splitA.publicKey.toBase58(), bps: 2_000 }, { label: 'Bob', wallet: splitB.publicKey.toBase58(), bps: 2_000 }, { label: 'Cara', wallet: splitC.publicKey.toBase58(), bps: 2_000 }, { label: 'Drew', wallet: splitD.publicKey.toBase58(), bps: 2_000 }, { label: 'Evan', wallet: splitE.publicKey.toBase58(), bps: 2_000 },
], timestamp: Date.now() });
const fiveSplitSignature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(fiveSplitPayload)), merchant.secretKey));
const fiveSplit = await server.createPayment(request({ payload: fiveSplitPayload, signature: fiveSplitSignature }));
const fivePrepared = await server.preparePayment(request({ payer: payer.publicKey.toBase58() }), fiveSplit.id);
assert.equal(Transaction.from(Buffer.from(fivePrepared.transaction, 'base64')).instructions.length, 6);
passed++; console.log('PASS Devnet split kill switch, two-recipient final receipt, and five-recipient atomic preparation');
// Additional USDC verification fixtures; no network settlement is represented.
const { getAssociatedTokenAddress,TOKEN_PROGRAM_ID }=await import('@solana/spl-token');
const usdcPayload=JSON.stringify({...JSON.parse(payload),asset:'USDC',amount:'1.25',timestamp:Date.now()});const usdcSig=bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(usdcPayload)),merchant.secretKey));const usdc=await server.createPayment(request({payload:usdcPayload,signature:usdcSig}));const usdcPrepared=await server.preparePayment(request({payer:payer.publicKey.toBase58()}),usdc.id);const usdcTx=Transaction.from(Buffer.from(usdcPrepared.transaction,'base64'));usdcTx.sign(payer);await server.submitPayment(request({attemptId:usdcPrepared.attemptId,attemptToken:usdcPrepared.attemptToken,transaction:usdcTx.serialize().toString('base64')}),usdc.id);const mint=new PublicKey(model.ASSETS.USDC.mint);const source=await getAssociatedTokenAddress(mint,payer.publicKey);const dest=await getAssociatedTokenAddress(mint,merchant.publicKey);let badMint=true;
Connection.prototype.getParsedTransaction=async()=>({blockTime:Math.floor(Date.now()/1000),meta:{err:null,postTokenBalances:[{accountIndex:2,mint:mint.toBase58(),owner:merchant.publicKey.toBase58()}]},transaction:{message:{accountKeys:[{pubkey:payer.publicKey,signer:true},{pubkey:merchant.publicKey,signer:false},{pubkey:dest,signer:false}],instructions:[{programId:new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),parsed:{type:'createIdempotent',info:{source:payer.publicKey.toBase58(),account:dest.toBase58(),wallet:merchant.publicKey.toBase58(),mint:mint.toBase58()}}},{programId:TOKEN_PROGRAM_ID,parsed:{type:'transferChecked',info:{source:source.toBase58(),destination:dest.toBase58(),authority:payer.publicKey.toBase58(),mint:badMint?payer.publicKey.toBase58():mint.toBase58(),tokenAmount:{amount:'1250000',decimals:6}}}},{programId:new PublicKey(model.MEMO_PROGRAM),parsed:`auno:${usdc.id}:${usdcPrepared.attemptId}`}]}}});Connection.prototype.getTransaction=async()=>({transaction:{message:usdcTx.compileMessage(),signatures:usdcTx.signatures.map(signature=>signature.signature?bs58.encode(signature.signature):'')}});await assert.rejects(()=>server.verifyPayment(usdc.id,usdcPrepared.attemptId,usdcPrepared.attemptToken));assert.notEqual((await server.getPayment(usdc.id)).status,'PAID');badMint=false;assert.equal((await server.verifyPayment(usdc.id,usdcPrepared.attemptId,usdcPrepared.attemptToken)).status,'PAID');passed++;console.log('PASS USDC rejects wrong mint and verifies correct amount, owner and message');console.log(`FINAL: ${passed} controlled test groups passed.`);

const usdcSecond = Keypair.generate();
const usdcTwoPayload = JSON.stringify({ ...JSON.parse(usdcPayload), title: 'Two recipient USDC split', reference: 'USDC2', recipients: [
  { label: 'Merchant', wallet: merchant.publicKey.toBase58(), bps: 5_000 },
  { label: 'Second', wallet: usdcSecond.publicKey.toBase58(), bps: 5_000 },
], timestamp: Date.now() });
const usdcTwoSignature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(usdcTwoPayload)), merchant.secretKey));
const usdcTwo = await server.createPayment(request({ payload: usdcTwoPayload, signature: usdcTwoSignature }));
const usdcTwoPrepared = await server.preparePayment(request({ payer: payer.publicKey.toBase58() }), usdcTwo.id);
const usdcTwoTransaction = Transaction.from(Buffer.from(usdcTwoPrepared.transaction, 'base64'));
usdcTwoTransaction.sign(payer);
await server.submitPayment(request({ attemptId: usdcTwoPrepared.attemptId, attemptToken: usdcTwoPrepared.attemptToken, transaction: usdcTwoTransaction.serialize().toString('base64') }), usdcTwo.id);
const usdcSecondAta = await getAssociatedTokenAddress(mint, usdcSecond.publicKey);
let wrongAtaOwner = true;
Connection.prototype.getParsedTransaction = async () => ({ blockTime: Math.floor(Date.now() / 1000), meta: { err: null, postTokenBalances: [
  { accountIndex: 3, mint: mint.toBase58(), owner: merchant.publicKey.toBase58() },
  { accountIndex: 4, mint: mint.toBase58(), owner: wrongAtaOwner ? payer.publicKey.toBase58() : usdcSecond.publicKey.toBase58() },
] }, transaction: { message: { accountKeys: [{ pubkey: payer.publicKey, signer: true }, { pubkey: merchant.publicKey, signer: false }, { pubkey: usdcSecond.publicKey, signer: false }, { pubkey: dest, signer: false }, { pubkey: usdcSecondAta, signer: false }], instructions: [
  { programId: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), parsed: { type: 'createIdempotent', info: { source: payer.publicKey.toBase58(), account: dest.toBase58(), wallet: merchant.publicKey.toBase58(), mint: mint.toBase58() } } },
  { programId: TOKEN_PROGRAM_ID, parsed: { type: 'transferChecked', info: { source: source.toBase58(), destination: dest.toBase58(), authority: payer.publicKey.toBase58(), mint: mint.toBase58(), tokenAmount: { amount: '625000', decimals: 6 } } } },
  { programId: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), parsed: { type: 'createIdempotent', info: { source: payer.publicKey.toBase58(), account: usdcSecondAta.toBase58(), wallet: usdcSecond.publicKey.toBase58(), mint: mint.toBase58() } } },
  { programId: TOKEN_PROGRAM_ID, parsed: { type: 'transferChecked', info: { source: source.toBase58(), destination: usdcSecondAta.toBase58(), authority: payer.publicKey.toBase58(), mint: mint.toBase58(), tokenAmount: { amount: '625000', decimals: 6 } } } },
  { programId: new PublicKey(model.MEMO_PROGRAM), parsed: `auno:${usdcTwo.id}:${usdcTwoPrepared.attemptId}` },
] } } });
Connection.prototype.getTransaction = async () => ({ transaction: { message: usdcTwoTransaction.compileMessage(), signatures: usdcTwoTransaction.signatures.map((signature) => signature.signature ? bs58.encode(signature.signature) : '') } });
await assert.rejects(() => server.verifyPayment(usdcTwo.id, usdcTwoPrepared.attemptId, usdcTwoPrepared.attemptToken), error => /ownership/.test(error.message));
wrongAtaOwner = false;
assert.equal((await server.verifyPayment(usdcTwo.id, usdcTwoPrepared.attemptId, usdcTwoPrepared.attemptToken)).status, 'PAID');
assert.equal((await server.publicSplitReceipt(usdcTwo.id)).asset, 'USDC');
const usdcFivePayload = JSON.stringify({ ...JSON.parse(usdcTwoPayload), title: 'Five recipient USDC split', reference: 'USDC5', recipients: [
  { label: 'One', wallet: splitA.publicKey.toBase58(), bps: 2_000 }, { label: 'Two', wallet: splitB.publicKey.toBase58(), bps: 2_000 }, { label: 'Three', wallet: splitC.publicKey.toBase58(), bps: 2_000 }, { label: 'Four', wallet: splitD.publicKey.toBase58(), bps: 2_000 }, { label: 'Five', wallet: splitE.publicKey.toBase58(), bps: 2_000 },
], timestamp: Date.now() });
const usdcFiveSignature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(usdcFivePayload)), merchant.secretKey));
const usdcFive = await server.createPayment(request({ payload: usdcFivePayload, signature: usdcFiveSignature }));
const usdcFivePrepared = await server.preparePayment(request({ payer: payer.publicKey.toBase58() }), usdcFive.id);
assert.equal(Transaction.from(Buffer.from(usdcFivePrepared.transaction, 'base64')).instructions.length, 11);
passed++; console.log('PASS USDC split enforces recipient ATAs and token owners for two recipients and prepares five recipients');
Object.assign(globalThis.__AUNO_ENV__,{SOLANA_NETWORK:'mainnet-beta',SOLANA_RPC_URL:'https://mainnet.example.invalid',AUNO_PUBLIC_ORIGIN:'https://mainnet.auno.cash',AUNO_MAINNET_ENABLED:'false',AUNO_ALLOWED_MERCHANTS:merchant.publicKey.toBase58(),AUNO_MAX_SOL_LAMPORTS:'100000000'});Connection.prototype.getGenesisHash=async()=>model.NETWORKS['mainnet-beta'].genesisHash;const mainOrigin='https://mainnet.auno.cash';const mainRequest=body=>new Request(mainOrigin+'/api/payments',{method:'POST',headers:{origin:mainOrigin,'content-type':'application/json'},body:JSON.stringify(body)});const mainPayload=JSON.stringify({merchantWallet:merchant.publicKey.toBase58(),title:'Mainnet beta test',description:'Controlled test record',asset:'SOL',amount:'0.1',recipient:merchant.publicKey.toBase58(),reference:'MAINNET',expiresAt:Date.now()+3600000,timestamp:Date.now(),origin:mainOrigin});const mainSignature=bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(mainPayload,'mainnet-beta')),merchant.secretKey));await assert.rejects(()=>server.createPayment(mainRequest({payload:mainPayload,signature:mainSignature})),error=>error.status===503);globalThis.__AUNO_ENV__.AUNO_MAINNET_ENABLED='true';const replaySignature=bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(mainPayload,'devnet')),merchant.secretKey));await assert.rejects(()=>server.createPayment(mainRequest({payload:mainPayload,signature:replaySignature})),error=>error.status===401);const mainPayment=await server.createPayment(mainRequest({payload:mainPayload,signature:mainSignature}));assert.equal(mainPayment.network,'mainnet-beta');const publicMerchant=Keypair.generate();const publicPayload=JSON.stringify({...JSON.parse(mainPayload),merchantWallet:publicMerchant.publicKey.toBase58(),recipient:publicMerchant.publicKey.toBase58(),reference:'PUBLIC',timestamp:Date.now()});const publicSignature=bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(publicPayload,'mainnet-beta')),publicMerchant.secretKey));const publicPayment=await server.createPayment(mainRequest({payload:publicPayload,signature:publicSignature}));assert.equal(publicPayment.merchantWallet,publicMerchant.publicKey.toBase58());await assert.rejects(()=>server.getPayment(p.id),error=>error.status===404);const overCapPayload=JSON.stringify({...JSON.parse(mainPayload),amount:'0.100000001',timestamp:Date.now()});const overCapSignature=bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(overCapPayload,'mainnet-beta')),merchant.secretKey));await assert.rejects(()=>server.createPayment(mainRequest({payload:overCapPayload,signature:overCapSignature})),error=>error.status===422&&/0.1 SOL/.test(error.message));const usdcMainnetPayload=JSON.stringify({...JSON.parse(mainPayload),asset:'USDC',timestamp:Date.now()});const usdcMainnetSignature=bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(usdcMainnetPayload,'mainnet-beta')),merchant.secretKey));await assert.rejects(()=>server.createPayment(mainRequest({payload:usdcMainnetPayload,signature:usdcMainnetSignature})),error=>error.status===422&&/SOL payment links only/.test(error.message));globalThis.__AUNO_ENV__.AUNO_MAINNET_ENABLED='false';await assert.rejects(()=>server.preparePayment(mainRequest({payer:payer.publicKey.toBase58()}),mainPayment.id),error=>error.status===503);passed++;console.log('PASS mainnet kill switch, network signatures, storage isolation, SOL-only, and cap controls');
sqlite.prepare('INSERT INTO payment_attempts (id,payment_id,payer,message_hash,attempt_token_hash,last_valid_block_height,created_at,updated_at,signature,status) VALUES (?,?,?,?,?,?,?,?,?,?)').run('scheduled-mainnet-attempt',mainPayment.id,payer.publicKey.toBase58(),'scheduled-message','scheduled-token',2_000_000_000,Date.now(),Date.now(),'scheduled-mainnet-signature','SUBMITTED');Connection.prototype.getParsedTransaction=async()=>null;Connection.prototype.getSignatureStatus=async()=>({value:null});const verifierRun=await server.verifyPendingPayments();assert.deepEqual(verifierRun,{checked:1,verified:0,failed:0,splitChecked:0,splitVerified:0,splitFailed:0});assert.equal(sqlite.prepare('SELECT status FROM payment_attempts WHERE id=?').get('scheduled-mainnet-attempt').status,'CONFIRMING');passed++;console.log('PASS scheduled verifier reconciles pending mainnet attempts without a browser secret');
