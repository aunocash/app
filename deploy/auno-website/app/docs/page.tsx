/* eslint-disable @next/next/no-img-element -- Reuses the exact main-navbar logo markup. */
import Link from "next/link";
import type { Metadata } from "next";
import { FiArrowRight, FiCheckCircle, FiCode, FiDownload, FiExternalLink, FiLock, FiShield } from "react-icons/fi";
import { Footer } from "../ui";
import { DocsSearch } from "./docs-search";
import { isMainnetRequest } from "../../lib/site-network";
import { serverMainnetSplitsEnabled } from "../../lib/runtime-env";

export const metadata: Metadata = {
  title: "AUNO Docs — Programmable Payments on Solana",
  description: "Implementation-aligned documentation for AUNO payment links, checkout, verification, and developer infrastructure.",
};

const navGroups = [
  { label: "GET STARTED", items: [["overview", "Overview"], ["getting-started", "Getting started"], ["payment-links", "Payment links"]] },
  { label: "PAYMENT MODEL", items: [["payment-model", "Payment model"], ["payment-primitives", "Payment primitives"], ["use-cases", "Use cases"]] },
  { label: "PAYMENTS", items: [["checkout-flow", "Checkout flow"], ["verification", "Transaction verification"], ["payment-status", "Payment status"], ["receipts", "Verified receipts"]] },
  { label: "DEVELOPER INFRASTRUCTURE", items: [["api-status", "API and SDK status"], ["security-model", "Security model"], ["network", "Network configuration"]] },
  { label: "ROADMAP", items: [["roadmap", "What comes next"]] },
] as const;

const searchItems = navGroups.flatMap((group) => group.items.map(([id, title]) => ({ id, title, group: group.label })));

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="docs-portal-section" id={id}><p className="docs-portal-kicker">{eyebrow}</p><h2>{title}</h2><div className="docs-portal-copy">{children}</div></section>;
}

export default async function DocsPage() {
  const mainnet = await isMainnetRequest();
  const networkLabel = mainnet ? "Solana Mainnet Beta" : "Solana Devnet";
  const releaseLabel = mainnet ? "Mainnet Beta" : "Developer preview";
  const mainnetSplits = mainnet && serverMainnetSplitsEnabled();
  return <>
    <header className="docs-portal-header">
      <Link className="docs-portal-brand" href="/" aria-label="AUNO home"><img className="brand-logo docs-portal-logo" src="/auno-logo.png" alt="" width="34" height="34" /><span>AUNO <b>Docs</b></span></Link>
      <DocsSearch items={searchItems} />
      <nav className="docs-portal-links" aria-label="Documentation links">
        <a href="#getting-started">Guides</a><a href="/developers">API reference</a><a href="#api-status">SDK status</a><a href="/roadmap">Roadmap</a><a href="/docs/download" download>Download</a><a className="docs-portal-launch" href="/dashboard/create">Launch app <FiExternalLink aria-hidden="true" /></a>
      </nav>
    </header>
    <main className="docs-portal">
      <div className="docs-portal-mobile-nav"><span>On this page</span><a href="#overview">Overview</a><a href="#payment-model">Payment model</a><a href="#checkout-flow">Checkout flow</a><a href="#api-status">API status</a><a href="#roadmap">Roadmap</a></div>
      <aside className="docs-portal-sidebar" aria-label="Documentation navigation">
        <div className="docs-portal-sidebar-intro"><span>DOCUMENTATION</span><small>{releaseLabel}</small></div>
        {navGroups.map((group) => <div className="docs-portal-nav-group" key={group.label}><p>{group.label}</p>{group.items.map(([id, title], index) => <a className={index === 0 && group.label === "GET STARTED" ? "active" : ""} href={"#" + id} key={id}>{title}</a>)}</div>)}
      </aside>
      <article className="docs-portal-content">
        <div className="docs-portal-breadcrumbs"><Link href="/">AUNO</Link><span>/</span><span>Docs</span></div>
        <section className="docs-portal-hero" id="overview">
          <div className="docs-portal-status"><span className="docs-portal-status-dot" /> {releaseLabel}</div>
          <h1>Build with clarity.</h1>
          <p className="docs-portal-lead">AUNO makes payment behavior explicit—from payment links and wallet-native checkout today to programmable settlement over time.</p>
          <div className="docs-portal-hero-actions"><a className="button" href="#getting-started">Start here <FiArrowRight aria-hidden="true" /></a><a className="docs-portal-text-link" href="/developers">View API surface <FiArrowRight aria-hidden="true" /></a><a className="docs-portal-text-link" href="/docs/download" download>Download docs bundle <FiDownload aria-hidden="true" /></a></div>
          <div className="docs-portal-hero-note"><FiLock aria-hidden="true" /> AUNO never requests seed phrases or private keys.</div>
        </section>
        <Section id="getting-started" eyebrow="01 / GET STARTED" title="Understand the payment path.">
          <p>AUNO is a non-custodial payment application for {networkLabel}. A merchant signs an immutable payment intent, a payer reviews the stored request, and the server verifies the finalized transaction before a receipt is created.</p>
          <div className="docs-portal-callout"><strong>{releaseLabel}</strong><span>{mainnet ? <>Public creation requires a signed merchant request. Each link is capped at 0.1 SOL or 100 USDC, and a receipt is issued only after finalized on-chain verification.</> : "Real wallet acceptance tests for SOL and USDC are still outstanding. Do not treat this release as an audited production payment processor."}</span></div>
          <div className="docs-portal-steps">{[["01", "Create", "Sign a payment request from the merchant wallet."], ["02", "Checkout", "Review the recipient, amount, asset, and network."], ["03", "Settle", "Sign the transfer in the payer wallet."], ["04", "Verify", "Confirm finalization before showing a receipt."]].map(([number, title, copy]) => <div key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></div>)}</div>
          {!mainnet && <p>Use the <a href="https://faucet.solana.com" target="_blank" rel="noreferrer">Solana faucet</a> for test SOL. Never fund devnet testing with mainnet assets.</p>}
        </Section>
        <Section id="payment-model" eyebrow="02 / PAYMENT MODEL" title="From transfers to payment logic.">
          <p>A basic transfer answers where value goes. AUNO is designed to make the rules around that transfer explicit: who receives it, how it is allocated, when it is released, and what conditions can control it.</p>
          <div className="docs-portal-callout muted"><strong>Layered architecture</strong><span>Applications → AUNO API, SDK, and payment components → payment logic → Solana settlement.</span></div>
          <p>The current release implements the payment-link and checkout foundation. The broader model below describes the direction of the product, not capabilities that are already enabled.</p>
        </Section>
        <Section id="payment-links" eyebrow="03 / PAYMENT LINKS" title="One link, one persisted request.">
          <p>Create a request with a title, amount, asset, recipient, and optional metadata. The server validates the merchant signature and stores the request in D1. Creation does not transfer funds.</p>
          <ul className="docs-portal-list"><li>Amounts are stored as integer base units.</li><li>Payment facts are immutable after creation.</li><li>Anyone with the link can view the public checkout details.</li>{mainnet && <li>Mainnet Beta links are capped at 0.1 SOL or 100 USDC.</li>}</ul>
        </Section>
        <Section id="payment-primitives" eyebrow="04 / PAYMENT PRIMITIVES" title="Compose clear operations.">
          <p>The long-term AUNO model is a set of reusable payment primitives. They can eventually be combined into flows such as escrowed split payments or milestone-based releases.</p>
          <div className="docs-portal-status-table"><div><strong>PAY</strong><span>{mainnet ? "SOL and USDC payment links with wallet-native checkout; Mainnet Beta." : "Payment Links and checkout foundation; developer preview."}</span></div><div><strong>SPLIT</strong><span>{mainnet ? (mainnetSplits ? "SOL and USDC multi-recipient settlement is active for the current Mainnet Beta policy." : "Multi-recipient settlement is unavailable until the Mainnet split feature policy is enabled.") : "Deterministic allocation preview; live multi-recipient settlement is not enabled."}</span></div><div><strong>HOLD / RELEASE</strong><span>Secure value and settle it later; planned with explicit authority.</span></div><div><strong>REFUND</strong><span>Return secured value under defined rules; planned.</span></div><div><strong>STREAM</strong><span>Distribute value over time; planned research.</span></div><div><strong>TRIGGER</strong><span>Execute payment logic when conditions are met; long-term direction.</span></div></div>
        </Section>
        <Section id="use-cases" eyebrow="05 / USE CASES" title="One payment layer, many workflows.">
          <p>The same primitives can support different application needs without changing who controls the wallet or how settlement is verified.</p>
          <ul className="docs-portal-list"><li>Commerce and marketplaces with structured checkout and revenue routing.</li><li>Freelance and service agreements with escrow or milestone releases.</li><li>Creator, affiliate, DAO, and treasury distributions.</li><li>SaaS, recurring compensation, and developer applications.</li><li>Future software-controlled and machine-to-machine payments.</li></ul>
        </Section>
        <Section id="checkout-flow" eyebrow="06 / WALLET-NATIVE CHECKOUT" title="Review first. Sign once.">
          <p>Checkout loads the stored payment intent rather than trusting query parameters. The server prepares a transaction from that intent. The wallet broadcasts it when supported, and the server only marks it paid after finalized verification of the payer, memo, expected transfers, asset, amount, and permitted instructions.</p>
          <div className="docs-portal-inline-status"><FiCheckCircle aria-hidden="true" /><span><strong>Current flow</strong> Confirm the payment details in your wallet, submit, then wait for finalized verification. The verifier reconciles pending attempts; manual verification remains available.</span></div>
          <p>If finalization is pending, retry verification instead of sending another payment. A rejected wallet prompt does not move funds.</p>
        </Section>
        <Section id="verification" eyebrow="07 / TRANSACTION VERIFICATION" title="A signature is not a receipt.">
          <p>PAID is written only by server verification against finalized Solana RPC data. Verification checks successful execution, payer signature, the per-attempt payment memo, expected transfers, asset, amount, destination, and permitted instructions.</p>
          <div className="docs-portal-check-grid"><div><FiCode aria-hidden="true" /><strong>Exact intent</strong><span>Stored amount, asset, and recipient</span></div><div><FiCheckCircle aria-hidden="true" /><strong>Finalized chain state</strong><span>Successful execution and confirmation</span></div><div><FiShield aria-hidden="true" /><strong>Idempotent receipt</strong><span>Duplicate verification returns the existing receipt</span></div></div>
        </Section>
        <Section id="payment-status" eyebrow="08 / PAYMENT LIFECYCLE" title="Status is server-authoritative.">
          <div className="docs-portal-status-table"><div><strong>ACTIVE</strong><span>Request is available for checkout.</span></div><div><strong>AWAITING_SIGNATURE</strong><span>Prepared attempt is waiting for the wallet.</span></div><div><strong>SUBMITTED</strong><span>Signature is recorded before RPC submission.</span></div><div><strong>CONFIRMING</strong><span>Finalization has not yet been established.</span></div><div><strong>PAID</strong><span>Server verification has completed successfully.</span></div><div><strong>FAILED / EXPIRED</strong><span>Execution failed or the request is no longer payable.</span></div></div>
        </Section>
        <Section id="receipts" eyebrow="09 / VERIFIED RECEIPTS" title="Show the facts that settled.">
          <p>A verified receipt includes the payment ID, amount, asset, recipient, payer, network, transaction signature, and chain timestamp. Explorer links {mainnet ? "open on Solana Mainnet." : <>explicitly use <code>cluster=devnet</code>.</>}</p>
        </Section>
        <Section id="api-status" eyebrow="10 / DEVELOPER INFRASTRUCTURE" title="The public API is not launched yet.">
          <p>The internal application routes support payment creation, retrieval, transaction preparation, submission, verification, and merchant history. They are not a stable public API contract.</p>
          <div className="docs-portal-api-card"><div><span className="docs-portal-method">INTERNAL</span><strong>Payment application routes</strong><p>Origin checks and signed wallet messages apply.</p></div><a href="/developers">Inspect the current surface <FiArrowRight aria-hidden="true" /></a></div>
          <div className="docs-portal-callout muted"><strong>Planned infrastructure</strong><span>API keys, a published <code>@auno/sdk</code>, webhooks, and external integrations are planned. Do not build against the homepage’s proposed SDK snippet.</span></div>
        </Section>
        <Section id="security-model" eyebrow="11 / SECURITY MODEL" title="Keep custody with the wallet.">
          <p>Merchant creation and history access require wallet signatures. Creation signatures include the origin and a five-minute timestamp window. Prepared payment facts cannot be replaced by the client, and unique payment-attempt memos reduce replay and concurrency risk.</p>
          <p>These controls are not a security audit. Production activation still requires independent review, abuse controls, monitoring, backups, and recovery procedures.</p>
        </Section>
        <Section id="network" eyebrow="12 / NETWORK CONFIGURATION" title={mainnet ? "Mainnet Beta is explicit." : "Devnet is intentional."}>
          <p>{mainnet ? <><code>SOLANA_NETWORK</code> is <code>mainnet-beta</code>. The service checks the Mainnet genesis hash and uses a dedicated authenticated RPC endpoint. SOL uses nine decimal places and USDC uses six; Mainnet Beta feature controls determine whether split settlement is active.</> : <><code>SOLANA_NETWORK</code> must be <code>devnet</code>. Mainnet is rejected. SOL uses nine decimal places; the configured Circle devnet USDC mint uses six. Public RPC endpoints may throttle, so a dedicated devnet RPC is recommended for reliable operation.</>}</p>
        </Section>
        <Section id="roadmap" eyebrow="13 / ROADMAP" title="From payment foundations to programmable money.">
          <p>The product direction moves from payment foundations to programmable settlement, a developer layer, external integrations, and eventually autonomous payments.</p>
          <div className="docs-portal-status-table"><div><strong>PHASE I</strong><span>{mainnet ? "Mainnet Beta foundation: capped links, wallet checkout, finalized receipts, and policy-gated splits." : "Payment foundation: links, SOL and USDC checkout, wallet interaction, status, and split preview."}</span></div><div><strong>PHASE II</strong><span>Programmable settlement: escrow, milestones, streaming, and conditional payments.</span></div><div><strong>PHASE III</strong><span>Developer layer: API, SDK, webhooks, and reusable payment components.</span></div><div><strong>PHASE IV</strong><span>Integrations: merchants, marketplaces, applications, and automation systems.</span></div><div><strong>PHASE V</strong><span>Autonomous payments: agent, machine-to-machine, and service-to-service settlement.</span></div></div>
          <div className="docs-portal-callout muted"><strong>Direction, not a deadline</strong><span>Future phases depend on implementation, testing, security review, and explicit release decisions.</span></div>
          <a className="docs-portal-text-link" href="/roadmap">Read the product roadmap <FiArrowRight aria-hidden="true" /></a>
        </Section>
        <div className="docs-portal-next"><span>Continue exploring</span><div><a href="/developers"><small>DEVELOPER SURFACE</small><strong>Internal API preview <FiArrowRight aria-hidden="true" /></strong></a><a href="/dashboard/create"><small>TRY IT</small><strong>Create a payment link <FiArrowRight aria-hidden="true" /></strong></a></div></div>
      </article>
      <aside className="docs-portal-toc" aria-label="On this page"><p>ON THIS PAGE</p><a href="#overview">Overview</a><a href="#getting-started">Payment path</a><a href="#checkout-flow">Checkout flow</a><a href="#verification">Verification</a><a href="#api-status">API status</a><a href="#roadmap">Roadmap</a></aside>
    </main>
    <Footer network={mainnet ? "mainnet" : undefined} />
  </>;
}
