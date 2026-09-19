import { FiArrowRight, FiCheckCircle, FiLock, FiShield } from "react-icons/fi";
import Link from "next/link";
import { MainnetBetaRibbon, Footer, Nav } from "./ui";
import { serverMainnetSplitsEnabled as mainnetSplitsEnabled } from "@/lib/runtime-env";

type MainnetPage = "docs" | "developers" | "roadmap" | "whitepaper" | "split";

const pageTitles: Record<MainnetPage, string> = {
  docs: "Mainnet Beta documentation.",
  developers: "Mainnet Beta developer access.",
  roadmap: "Mainnet Beta rollout.",
  whitepaper: "Mainnet Beta operating model.",
  split: "Split payments are unavailable.",
};

export function MainnetHome() {
  const splitsEnabled = mainnetSplitsEnabled();
  return <><Nav network="mainnet" /><main><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="line" /> AUNO MAINNET BETA</div><h1>Payments with<br /><em>clear limits.</em></h1><p className="lead">Standard SOL payment links for any valid merchant wallet on Solana Mainnet.</p><div className="actions"><a className="button" href="/dashboard/create">Open Mainnet Beta <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></a><a className="text-link" href="/docs">Read Mainnet docs <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></a></div><p className="hero-status"><strong>Mainnet Beta live</strong><span>Payments are available to any merchant wallet.</span></p><MainnetBetaRibbon features={splitsEnabled ? "USDC" : "USDC and split payments"} /><div className="hero-trust"><span><FiShield aria-hidden="true" /> Non-custodial by design</span></div></div><div className="link-preview"><div className="panel-title">Create Payment <span className="badge">MAINNET BETA</span></div><label>Title<div className="mock-input">AUNO Mainnet Payment</div></label><div className="two"><label>Amount<div className="mock-input">0.10</div></label><label>Asset<div className="mock-input mock-select">SOL</div></label></div><label>Recipient<div className="mock-input muted">Solana wallet address</div></label><a className="button wide" href="/dashboard/create">Open Payment Creator <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></a></div></section><section className="section checkout-band"><div className="eyebrow">MAINNET BETA CONTROLS</div><h2>Bounded by design.</h2><div className="steps">{[["01", "PUBLIC ACCESS", "Any valid wallet can create a signed payment link."], ["02", "SOL ONLY", splitsEnabled ? "USDC remains unavailable in this beta. Split payments are enabled for approved Mainnet merchants." : "USDC and split payments are unavailable in this beta."], ["03", "0.1 SOL MAX", "Each payment link is capped at 0.1 SOL."], ["04", "VERIFY", "Receipts require finalized onchain verification."]].map((step) => <div key={step[0]}><span>{step[0]}</span><h4>{step[1]}</h4><p>{step[2]}</p></div>)}</div></section></main><Footer network="mainnet" /></>;
}

export function MainnetInfoPage({ page }: { page: MainnetPage }) {
  const splitsEnabled = mainnetSplitsEnabled();
  return <><Nav network="mainnet" /><main className="page-shell"><div className="eyebrow">AUNO MAINNET BETA <span className="badge">LIVE</span></div><h1>{page === "split" && splitsEnabled ? "Mainnet Split Payments" : pageTitles[page]}</h1><p>{page === "split" && splitsEnabled ? "Verified SOL split payments for approved Mainnet merchants." : "Mainnet Beta supports public standard SOL payment links for valid wallet holders."}</p><MainnetBetaRibbon features={splitsEnabled ? "USDC" : "USDC and split payments"} /><section className="panel"><div className="panel-title">Current safeguards</div><div className="docs-portal-status-table"><div><FiLock aria-hidden="true" /><strong>Settlement enabled</strong><span>Payments are available to any merchant wallet.</span></div><div><FiCheckCircle aria-hidden="true" /><strong>Strict scope</strong><span>{splitsEnabled ? "SOL only, 2–5 recipients for splits, and a maximum of 0.1 SOL per link." : "SOL only, one recipient, and a maximum of 0.1 SOL per link."}</span></div><div><FiShield aria-hidden="true" /><strong>Public creation</strong><span>Any valid wallet can create a signed SOL payment link.</span></div></div></section><div className="actions"><a className="button" href="/dashboard/create">Open Mainnet Beta <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></a><Link className="text-link" href="/">Back to Mainnet overview <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></Link></div></main><Footer network="mainnet" /></>;
}
