export const NETWORK = 'devnet' as const;
export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const ASSETS = { SOL: { decimals: 9, mint: null }, USDC: { decimals: 6, mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' } } as const;
export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export type Asset = keyof typeof ASSETS;
export type Status = 'DRAFT'|'ACTIVE'|'AWAITING_SIGNATURE'|'SUBMITTED'|'CONFIRMING'|'PAID'|'FAILED'|'EXPIRED'|'CANCELLED';
export type Recipient = {address:string;percentageBps:number;amountBaseUnits:string};
export type PaymentIntent = {id:string;merchantWallet:string;title:string;description:string;asset:Asset;amount:string;amountBaseUnits:string;recipients:Recipient[];reference:string;expiresAt:number;status:Status;transactionSignature:string|null;payer:string|null;createdAt:number;updatedAt:number;paidAt:number|null};
export function toBaseUnits(value:string,decimals:number):bigint {if(!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)||value.length>24)throw new Error('Enter a positive decimal amount without exponent notation.');const [whole,fraction='']=value.split('.');if(fraction.length>decimals)throw new Error(`Use no more than ${decimals} decimal places.`);const n=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0'));if(n<=0n||n>9007199254740991n)throw new Error('Amount is outside the supported range.');return n;}
export function displayUnits(value:bigint,decimals:number){const s=value.toString().padStart(decimals+1,'0');return decimals?(s.slice(0,-decimals)+'.'+s.slice(-decimals)).replace(/\.?0+$/,''):s;}
export function allocate(total:bigint,bps:number[]):bigint[]{if(!bps.length||bps.length>5||bps.some(n=>!Number.isInteger(n)||n<=0)||bps.reduce((a,b)=>a+b,0)!==10000)throw new Error('Allocations must total 10,000 basis points.');const values=bps.map(n=>total*BigInt(n)/10000n);values[0]+=total-values.reduce((a,b)=>a+b,0n);if(values.some(n=>n<=0n))throw new Error('Amount is too small for these allocations.');return values;}
export function explorer(signature:string){return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;}
export function creationMessage(payload:string){return 'AUNO devnet payment creation\n'+payload;}
export function historyMessage(wallet:string,timestamp:number,origin:string){return `AUNO devnet payment history\n${origin}\n${wallet}\n${timestamp}`;}
