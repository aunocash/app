import { FiArrowRight, FiCheckCircle, FiLock, FiShield } from "react-icons/fi";
import Link from "next/link";
import { Footer, Nav } from "./ui";

type MainnetPage = "docs" | "developers" | "roadmap" | "whitepaper";

const pageTitles: Record<MainnetPage, string> = {
  docs: "Mainnet Beta documentation.",
  developers: "Mainnet Beta developer access.",
  roadmap: "Mainnet Beta rollout.",
  whitepaper: "Mainnet Beta operating model.",
};

export function MainnetHome() {
  return <><Nav network="mainnet" /><main><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="line" /> AUNO MAINNET BETA</div><h1>Payments with<br /><em>clear limits.</em></h1><p className="lead">Standard SOL payment links for allowlisted merchants on Solana Mainnet.</p><div className="actions"><a className="button" href="/dashboard/create">Open Mainnet Beta <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></a><a className="text-link" href="/docs">Read Mainnet docs <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></a></div><p className="hero-status"><strong>Mainnet Beta staging</strong><span>Settlement is disabled until the security and rollout gates are complete.</span></p><div className="hero-trust"><span><FiShield aria-hidden="true" /> Non-custodial by design</span></div></div><div className="link-preview"><div className="panel-title">Create Payment <span className="badge">MAINNET BETA</span></div><label>Title<div className="mock-input">AUNO Mainnet Payment</div></label><div className="two"><label>Amount<div className="mock-input">0.10</div></label><label>Asset<div className="mock-input mock-select">SOL</div></label></div><label>Recipient<div className="mock-input muted">Approved Solana wallet address</div></label><a className="button wide" href="/dashboard/create">Open Payment Creator <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></a></div></section><section className="section checkout-band"><div className="eyebrow">MAINNET BETA CONTROLS</div><h2>Bounded by design.</h2><div className="steps">{[["01", "ALLOWLIST", "Only approved merchant wallets can create payment links."], ["02", "SOL ONLY", "USDC and split payments are unavailable in this beta."], ["03", "0.1 SOL MAX", "Each payment link is capped at 0.1 SOL."], ["04", "VERIFY", "Receipts require finalized onchain verification."]].map((step) => <div key={step[0]}><span>{step[0]}</span><h4>{step[1]}</h4><p>{step[2]}</p></div>)}</div></section></main><Footer network="mainnet" /></>;
}

export function MainnetInfoPage({ page }: { page: MainnetPage }) {
  return <><Nav network="mainnet" /><main className="page-shell"><div className="eyebrow">AUNO MAINNET BETA <span className="badge">STAGING</span></div><h1>{pageTitles[page]}</h1><p>Mainnet Beta is a controlled rollout for allowlisted merchants. It supports standard SOL payment links only.</p><section className="panel"><div className="panel-title">Current safeguards</div><div className="docs-portal-status-table"><div><FiLock aria-hidden="true" /><strong>Settlement disabled</strong><span>No Mainnet payment can be created, prepared, or submitted during staging.</span></div><div><FiCheckCircle aria-hidden="true" /><strong>Strict scope</strong><span>SOL only, one recipient, and a maximum of 0.1 SOL per link.</span></div><div><FiShield aria-hidden="true" /><strong>Controlled access</strong><span>Merchant wallets must be explicitly allowlisted by deployment configuration.</span></div></div></section><div className="actions"><a className="button" href="/dashboard/create">Open Mainnet Beta <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></a><Link className="text-link" href="/">Back to Mainnet overview <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></Link></div></main><Footer network="mainnet" /></>;
}
