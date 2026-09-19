/* eslint-disable @next/next/no-html-link-for-pages -- Full document navigation resets payment wallet state. */
"use client";

import { useState } from "react";
import type { IconType } from "react-icons";
import {
  FiArrowDown,
  FiArrowRight,
  FiArrowUpRight,
  FiCheckSquare,
  FiChevronDown,
  FiCopy,
  FiCornerDownRight,
  FiCreditCard,
  FiGitBranch,
  FiLock,
  FiMenu,
  FiRefreshCw,
  FiSend,
  FiShield,
  FiX,
} from "react-icons/fi";
import { FaXTwitter } from "react-icons/fa6";
import { SiSolana } from "react-icons/si";
import { toast } from "sonner";
import { SplitFlow } from "./split-flow";

/* Full-document navigation deliberately resets wallet state between payment surfaces. */
const ActionArrow = () => <FiArrowRight className="inline-icon action-icon" aria-hidden="true" />;
const LaunchIcon = () => <FiArrowUpRight className="inline-icon action-icon" aria-hidden="true" />;
const CONTRACT_ADDRESS = "52YLW3zzqzViDnZ421Vu17YyTv8TyMfxjUqZ8AYqpump";
const isMainnetSite = () => typeof window !== "undefined" && window.location.hostname === "mainnet.auno.cash";

type ProductFeature = {
  icon: IconType;
  title: string;
  description: string;
  status: string;
  href: string;
};

const productFeatures: ProductFeature[] = [
  { icon: FiSend, title: "Payment Links", description: "Share a request with a fixed amount and destination.", status: "DEVELOPER PREVIEW", href: "/dashboard/create" },
  { icon: FiCreditCard, title: "Checkout", description: "SOL and USDC wallet signing, with server verification.", status: "DEVELOPER PREVIEW", href: "/docs#checkout-flow" },
  { icon: FiGitBranch, title: "Split Payments", description: "Calculate precise allocations before settlement.", status: "DEVELOPER PREVIEW", href: "/split" },
  { icon: FiLock, title: "Escrow", description: "Conditional release with explicit authority.", status: "PLANNED", href: "/roadmap" },
  { icon: FiCheckSquare, title: "Milestones", description: "Payments aligned with project deliverables.", status: "PLANNED", href: "/roadmap" },
  { icon: FiRefreshCw, title: "Subscriptions", description: "Recurring payments with wallet-aware consent.", status: "RESEARCH", href: "/roadmap" },
];

export function Brand() {
  return <a href="/" className="brand" aria-label="AUNO home"><img className="brand-logo" src="/auno-logo.png" alt="" width="48" height="48" />AUNO<span className="brand-dot">®</span></a>;
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const mainnet = isMainnetSite();
  return <header className="nav"><div className="nav-inner"><Brand /><div className="nav-actions"><button className="menu" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}</button></div><nav className={open ? "open" : ""}><a href="/#product">Product</a><a href="/developers">Developers</a><a href="/docs">Docs</a><a href="/roadmap">Roadmap</a><a className="social-link nav-social-link" href="https://x.com/aunocash" target="_blank" rel="noreferrer" aria-label="Follow AUNO on X"><FaXTwitter aria-hidden="true" /></a><a className="button small" href="/dashboard/create">{mainnet ? "Mainnet Beta" : "Try on Devnet"} <LaunchIcon /></a></nav></div></header>;
}

export function Footer() {
  async function copyContractAddress() {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      toast.success("Contract address copied");
    } catch {
      toast.error("Could not copy the contract address. Please copy it manually.");
    }
  }

  return <footer><div><Brand /><p>Programmable Payments on Solana.</p><div className="contract-address"><span>CA</span><code title={CONTRACT_ADDRESS}>{CONTRACT_ADDRESS}</code><button type="button" onClick={copyContractAddress} aria-label="Copy AUNO contract address"><FiCopy aria-hidden="true" /></button></div></div><div><a href="/#product">Product</a><a href="/developers">Developers</a><a href="/docs">Documentation</a><a href="/whitepaper">Whitepaper</a><a href="/roadmap">Roadmap</a><a className="social-link footer-social-link" href="https://x.com/aunocash" target="_blank" rel="noreferrer" aria-label="Follow AUNO on X"><FaXTwitter aria-hidden="true" /></a></div><div className="footer-bottom"><span>© 2026 AUNO</span><span>Value in motion.</span><span>Designed for auno.cash</span></div></footer>;
}

export function Flow() {
  return <div className="flow" aria-hidden="true"><div className="wash w1" /><div className="wash w2" /><svg viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="line"><stop stopColor="#fd6c03" stopOpacity="0" /><stop offset=".48" stopColor="#fd6c03" stopOpacity=".5" /><stop offset="1" stopColor="#fd6c03" stopOpacity="0" /></linearGradient><path id="flow-a" d="M-100 640C220 610 340 95 620 240S950 600 1320 100" /><path id="flow-b" d="M-100 690C240 580 300 100 640 280S1000 480 1330 200" /><path id="flow-c" d="M620 240C900 370 920 650 1300 600" /></defs><g fill="none" stroke="url(#line)"><use href="#flow-a" /><use href="#flow-b" /><use href="#flow-c" /></g>{["flow-a", "flow-b", "flow-c"].map((path, index) => <circle key={path} r="3.5" fill="#fd6c03"><animateMotion dur={`${12 + index * 4}s`} repeatCount="indefinite"><mpath href={`#${path}`} /></animateMotion></circle>)}</svg></div>;
}

export function PaymentCard() {
  return <div className="payment-scene"><span className="scene-label">A PAYMENT. A WORLD OF POSSIBILITIES.</span><div className="float-tag"><FiArrowUpRight className="inline-icon" aria-hidden="true" /> Made to move with you</div><div className="payment-card"><div className="card-top"><span className="mini-brand"><img src="/auno-logo.png" alt="" width="32" height="32" /> AUNO</span><span className="badge">EXAMPLE</span></div><div className="invoice-icon"><FiSend aria-hidden="true" /></div><h3>Website Development</h3><p className="card-sub">Payment request</p><div className="amount">100<span>USDC</span></div><div className="card-detail"><span>Recipient</span><span>8Ks…91Q <FiArrowUpRight className="inline-icon" aria-hidden="true" /></span></div><div className="card-detail"><span>Network</span><span>Solana Devnet</span></div><a className="button wide" href="/dashboard/create">Create a payment like this <LaunchIcon /></a><p className="card-foot"><FiShield className="inline-icon" aria-hidden="true" /> Non-custodial by design</p></div><div className="settle-tag"><FiCornerDownRight aria-hidden="true" /><div>One link. Direct settlement.<small>Illustrative preview · No funds moved</small></div></div></div>;
}

export function Home() {
  return <><Nav /><main><section className="hero"><Flow /><div className="hero-copy"><div className="eyebrow"><span className="line" /> PAYMENT INFRASTRUCTURE FOR SOLANA</div><h1>Money should be<br /><em>programmable.</em></h1><p className="lead">Create payment links, accept SOL and USDC,<br className="desktop" /> and build programmable payment flows on Solana.</p><div className="actions"><a className="button" href="/dashboard/create">Try on Devnet <LaunchIcon /></a><a className="text-link" href="/developers">Explore Developers <ActionArrow /></a></div><p className="hero-status"><strong>Public Beta · Solana Devnet</strong><span>Test payment flows with SOL and USDC before mainnet release.</span></p><div className="hero-trust"><span><SiSolana aria-hidden="true" /> Built on Solana</span></div></div><PaymentCard /><div className="hero-bottom"><span>VALUE IN MOTION</span><span>Built for the way money should move.</span><a href="#product" aria-label="Explore product"><FiArrowDown aria-hidden="true" /></a></div></section><div className="network-strip"><span>A simpler payment layer.</span><span>Payment links</span><span>Wallet-native checkout</span><span>Verified receipts</span></div><section id="product" className="section feature-two"><div><div className="eyebrow">01 / PAYMENT LINKS</div><h2>One link.<br />Ready to get paid.</h2><p>Create a payment request with a fixed amount and recipient. Share the link, and let your customer pay directly from their wallet.</p><a className="text-link" href="/dashboard/create">Create your first link <ActionArrow /></a><div className="detail-note">SOL + USDC · Devnet only<br />Payment flows await real wallet acceptance testing.</div></div><div className="link-preview"><div className="panel-title">Create Payment <span className="badge">DEVNET</span></div><label>Title<div className="mock-input">Website Development</div></label><div className="two"><label>Amount<div className="mock-input">100.00</div></label><label>Asset<div className="mock-input mock-select">USDC <FiChevronDown className="inline-icon" aria-hidden="true" /></div></label></div><label>Recipient<div className="mock-input muted">Your Solana wallet address</div></label><a className="button wide" href="/dashboard/create">Open Payment Creator <ActionArrow /></a></div></section><section className="section checkout-band"><div className="eyebrow">02 / WALLET-NATIVE CHECKOUT</div><h2>Checkout without the friction.</h2><p>The amount, asset, network, and destination stay visible.<br />You approve the transfer in your own wallet.</p><div className="steps">{[["01", "CONNECT", "Choose your Solana wallet."], ["02", "REVIEW", "Confirm the payment details."], ["03", "SIGN", "Authorize on devnet."], ["04", "VERIFY", "Receive a verified receipt."]].map((step) => <div key={step[0]}><span>{step[0]}</span><h4>{step[1]}</h4><p>{step[2]}</p></div>)}</div><a className="text-link" href="/docs#checkout-flow">See how checkout works <ActionArrow /></a></section><section id="split-payments" className="section feature-two split-feature"><div><div className="eyebrow">03 / SPLIT PAYMENTS <span className="badge">PLANNED</span></div><h2>One payment.<br />Multiple destinations.</h2><p>Define where value goes before the payment happens. A single transaction can route a payment to your team, partners, and treasury.</p><a className="text-link" href="/split">Explore Split Payment <ActionArrow /></a><p className="detail-note">Interactive allocation preview. Live split settlement is not enabled.</p></div><SplitFlow /></section><section className="section"><div className="section-heading"><div><div className="eyebrow">THE PAYMENT TOOLKIT</div><h2>Payments that follow your rules.</h2></div><a href="/roadmap" className="text-link">View roadmap <ActionArrow /></a></div><div className="feature-grid">{productFeatures.map((feature) => { const Icon = feature.icon; return <a className="feature" href={feature.href} key={feature.title}><div className="feature-top"><span className="feature-icon"><Icon aria-hidden="true" /></span><span className="badge">{feature.status}</span></div><h3>{feature.title}</h3><p>{feature.description}</p></a>; })}</div></section><section className="developer-section section feature-two"><div><div className="eyebrow">FOR THE BUILDERS</div><h2>Built for developers.</h2><p>Add Solana payments to your product, with transparent payment states and independently verified settlement.</p><div className="actions"><a className="button light" href="/docs">Read the Docs <LaunchIcon /></a><a className="text-link" href="/developers">Explore API <ActionArrow /></a></div></div><div className="code-panel"><div><span>payments.ts</span><span className="badge">PROPOSED SDK</span></div><pre><code>{'const payment = await auno.payments.create({\n  title: "Website Development",\n  amount: "100",\n  asset: "USDC",\n  recipient: merchantWallet,\n});\n\nreturn payment.checkoutUrl;'}</code></pre><small>Design preview. @auno/sdk is not published.</small></div></section><section className="section ecosystem"><div><div className="eyebrow">THE AUNO ECOSYSTEM</div><h2>Infrastructure comes first.</h2><p>$AUNO is the proposed ecosystem token. SOL and USDC payments do not require it. No token contract, launch, or utility is verified in this release.</p><a href="/whitepaper" className="text-link">Read the whitepaper <ActionArrow /></a></div><div className="token-label">$AUNO<span className="badge">COMING SOON · PROPOSED</span></div></section><section className="final-cta"><div className="eyebrow">YOUR NEXT PAYMENT STARTS HERE</div><h2>Move value your way.</h2><p>Create programmable payment flows on Solana.</p><div className="actions"><a className="button" href="/dashboard/create">Launch AUNO <LaunchIcon /></a><a className="text-link" href="/docs">Read the Docs <ActionArrow /></a></div></section></main><Footer /></>;
}
