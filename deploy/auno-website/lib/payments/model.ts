import { PublicKey } from '@solana/web3.js';

export const NETWORKS = {
  devnet: {
    id: 'devnet',
    label: 'Solana Devnet',
    genesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
    defaultRpc: 'https://api.devnet.solana.com',
    explorerCluster: 'devnet',
    supportsUsdc: true,
  },
  'mainnet-beta': {
    id: 'mainnet-beta',
    label: 'Solana Mainnet Beta',
    genesisHash: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
    defaultRpc: '',
    explorerCluster: null,
    supportsUsdc: false,
  },
} as const;
export type NetworkId = keyof typeof NETWORKS;
export type PaymentNetwork = NetworkId;
export const DEVNET_RPC = NETWORKS.devnet.defaultRpc;
export const ASSETS = { SOL: { decimals: 9, mint: null }, USDC: { decimals: 6, mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' } } as const;
export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export type Asset = keyof typeof ASSETS;
export type PaymentStatus = 'ACTIVE'|'PAID'|'EXPIRED'|'CANCELLED';
export type AttemptStatus = 'PREPARED'|'SUBMITTED'|'CONFIRMING'|'VERIFIED'|'REJECTED'|'EXPIRED'|'ABANDONED';
export type Status = PaymentStatus|AttemptStatus;
export type Recipient = {position:number;label:string;address:string;percentageBps:number;amountBaseUnits:string};
export type SplitRecipient = {label:string;wallet:string;bps:number};
export type PaymentIntent = {id:string;network:PaymentNetwork;merchantWallet:string;title:string;description:string;asset:Asset;amount:string;amountBaseUnits:string;recipients:Recipient[];reference:string;expiresAt:number;status:PaymentStatus;transactionSignature:string|null;payer:string|null;createdAt:number;updatedAt:number;paidAt:number|null};
export function toBaseUnits(value:string,decimals:number):bigint {if(!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)||value.length>24)throw new Error('Enter a positive decimal amount without exponent notation.');const [whole,fraction='']=value.split('.');if(fraction.length>decimals)throw new Error(`Use no more than ${decimals} decimal places.`);const n=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0'));if(n<=0n||n>9007199254740991n)throw new Error('Amount is outside the supported range.');return n;}
export function displayUnits(value:bigint,decimals:number){const s=value.toString().padStart(decimals+1,'0');return decimals?(s.slice(0,-decimals)+'.'+s.slice(-decimals)).replace(/\.?0+$/,''):s;}
export function allocate(total:bigint,bps:number[]):bigint[]{if(!bps.length||bps.length>5||bps.some(n=>!Number.isInteger(n)||n<=0)||bps.reduce((a,b)=>a+b,0)!==10000)throw new Error('Allocations must total 10,000 basis points.');const values=bps.map(n=>total*BigInt(n)/10000n);values[0]+=total-values.reduce((a,b)=>a+b,0n);if(values.some(n=>n<=0n))throw new Error('Amount is too small for these allocations.');return values;}
export function percentToBps(value:string):number{if(!/^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/.test(value))throw new Error('Enter a percentage with no more than two decimal places.');const [whole,fraction='']=value.split('.');const bps=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(bps<=0||bps>10000)throw new Error('Allocation percentages must be greater than 0 and no more than 100.');return bps;}
export function validateSplitRecipients(recipients:SplitRecipient[]):SplitRecipient[]{
  if(recipients.length<2||recipients.length>5)throw new Error('Split payments require 2 to 5 recipients.');
  const seen=new Set<string>();
  const normalized=recipients.map((recipient)=>{
    const label=recipient.label.trim();
    if(!label)throw new Error('Each recipient needs a label.');
    let wallet:string;
    try{const key=new PublicKey(recipient.wallet.trim());if(!PublicKey.isOnCurve(key.toBytes()))throw new Error();wallet=key.toBase58();}catch{throw new Error('Enter a valid on-curve Solana wallet for every recipient.');}
    if(seen.has(wallet))throw new Error('Each recipient wallet must be unique.');
    seen.add(wallet);
    return {label,wallet,bps:recipient.bps};
  });
  allocate(10000n,normalized.map((recipient)=>recipient.bps));
  return normalized;
}
export function validateRecipients(recipients:SplitRecipient[]):SplitRecipient[]{
  if(recipients.length===1){
    const recipient=recipients[0];
    const label=recipient.label.trim();
    if(!label||recipient.bps!==10000)throw new Error('A standard payment requires one recipient allocated at 100%.');
    let wallet:string;
    try{const key=new PublicKey(recipient.wallet.trim());if(!PublicKey.isOnCurve(key.toBytes()))throw new Error();wallet=key.toBase58();}catch{throw new Error('Enter a valid on-curve Solana wallet for the recipient.');}
    return [{label,wallet,bps:10000}];
  }
  return validateSplitRecipients(recipients);
}
export function networkForOrigin(origin:string):NetworkId { try { return new URL(origin).hostname === 'mainnet.auno.cash' ? 'mainnet-beta' : 'devnet'; } catch { return 'devnet'; } }
export function explorer(signature:string,network:NetworkId='devnet'){const cluster=NETWORKS[network].explorerCluster;return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${cluster?`?cluster=${cluster}`:''}`;}
export function creationMessage(payload:string,network:NetworkId='devnet'){return `AUNO ${network} payment creation\n${payload}`;}
export function historyMessage(wallet:string,timestamp:number,origin:string,network:NetworkId='devnet'){return `AUNO ${network} payment history\n${origin}\n${wallet}\n${timestamp}`;}
