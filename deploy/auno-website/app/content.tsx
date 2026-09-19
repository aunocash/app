import { FiArrowRight, FiExternalLink } from 'react-icons/fi';
import { Footer, Nav } from './ui';
const docs=[
['getting-started','Getting started','AUNO is a non-custodial payment application for Solana devnet. Use a Solana Wallet Standard wallet with devnet support. Fund it with test SOL for network fees and test USDC if needed. This release is a developer preview, not an audited production payment processor. Real SOL and USDC wallet acceptance tests remain outstanding.'],
['create-payment-link','Create a payment link','Connect your merchant wallet at Create Payment. Enter a title, amount, asset, recipient, optional description and reference, and expiration. Sign the creation message. The server validates your signature and persists an immutable request in D1. Copy the generated checkout URL. Creation does not transfer funds. Public checkout reveals payment details to anyone who can access the Site and knows the link.'],
['checkout-flow','Checkout flow','Open a stored payment link. Review the full recipient address, amount, asset, and devnet network before connecting a payer wallet. The server prepares the transaction from the stored intent. Your wallet signs it; the server checks that the signed message exactly matches the prepared transaction before submission. Click Verify Payment after submission. If finalization is pending, retry verification rather than sending another payment.'],
['sol-payments','SOL payments','Amounts support up to nine decimal places and are converted to integer lamports. Settlement uses a native System Program transfer with a unique memo bound to both the payment and its attempt. The payer pays network fees in addition to the requested amount. Self-payments and off-curve recipients are rejected in this release.'],
['usdc-payments','USDC payments','Devnet USDC uses six decimal places and the Circle mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU. The payer needs USDC in its associated token account and SOL for network fees. Checkout can create the recipient associated token account idempotently; the payer covers rent when required. The transferChecked instruction binds the amount, decimals, and mint. This integration is not labeled working until a real devnet USDC payment passes acceptance testing.'],
['split-payments','Split payments','The calculator uses integer base units and basis points. Allocations must total 10,000 BPS, with one to five positive allocations. Each share is floored; the first recipient gets the remainder. Zero-value allocations fail. The calculator is operational as a preview; multi-recipient settlement is not enabled. Future settlement must compose all transfers atomically and verify every destination.'],
['payment-status','Payment status','ACTIVE means a request is available. AWAITING_SIGNATURE is a prepared attempt waiting for the wallet. SUBMITTED records a signature before RPC submission so an uncertain RPC response can be reconciled. CONFIRMING means finalization has not yet been established. PAID is written only by server verification. FAILED means RPC reported execution failure; EXPIRED means the request is no longer payable. DRAFT and CANCELLED are reserved model states; cancellation is not exposed in this release.'],
['receipts','Receipts','Verified receipts display the payment ID, amount, asset, recipient, payer, network, transaction signature, and chain timestamp. Explorer links explicitly use cluster=devnet. A signature alone is never a receipt. No receipt or successful transaction is fabricated for the homepage example.'],
['network-configuration','Network configuration','SOLANA_NETWORK must be devnet. SOLANA_RPC_URL is a server-only setting and defaults to the public devnet RPC. Every transaction operation checks the chain genesis hash. Mainnet is intentionally rejected. The USDC mint and decimals are centralized. Use a dedicated devnet RPC for reliable operation; public endpoints may throttle.'],
['security-model','Security model','AUNO never requests seed phrases or private keys. Merchant creation and history access require wallet signatures. Creation signatures include the origin and a five-minute timestamp window. Payment details are immutable after creation. Server preparation, message equality, signature validation, a unique payment-attempt memo, and finalized RPC verification protect the settlement path. D1 unique indexes prevent signature reuse and duplicate creation. An attempt lease reduces concurrent payment attempts. These controls are not a security audit.'],
['api-sdk-status','API and SDK status','The internal application endpoints support creating and retrieving payments, preparing and submitting transactions, verifying signatures, and reading merchant history. They are not a stable public API. @auno/sdk, API keys, webhooks, and external integrations are planned. Code shown on the homepage is a proposed SDK interface, not an installable package.'],
['error-handling','Error handling','A rejected wallet prompt does not move funds. Invalid recipients and unsupported decimal precision are rejected. Insufficient token balance, insufficient SOL for fees, a stale blockhash, and RPC errors can prevent submission. If a signature exists or submission is uncertain, verify before initiating another transfer. The app retains the recorded signature in the database. Database or RPC failures return an unavailable state and never mark a payment as paid.'],
['mainnet-readiness','Mainnet readiness','Production activation requires real SOL and USDC end-to-end tests, split verification tests before enabling splits, an independent security review, authenticated public merchant access, robust abuse controls, a dedicated RPC, backups, monitoring, recovery procedures, and explicit owner approval. A low-value production acceptance test must follow configuration review. Mainnet is disabled; token launch, custody, and irreversible token actions are outside this release.']
];
export function Docs(){return <><Nav/><main className="page-shell"><div className="eyebrow">DOCUMENTATION <span className="badge">DEVELOPER PREVIEW</span></div><h1>Build with clarity.</h1><p>How AUNO payments work, what is available, and what comes next.</p><div className="docs-layout"><aside className="docs-nav">{docs.map(x=><a href={'#'+x[0]} key={x[0]}>{x[1]}</a>)}</aside><article>{docs.map(x=><section id={x[0]} className="doc-section" key={x[0]}><h2>{x[1]}</h2><p>{x[2]}</p>{x[0]==='getting-started'&&<p>Test assets: <a href="https://faucet.solana.com" target="_blank" rel="noreferrer">Solana faucet</a> · <a href="https://faucet.circle.com" target="_blank" rel="noreferrer">Circle faucet</a>. Never fund a devnet test with mainnet assets.</p>}{x[0]==='usdc-payments'&&<p>Mint reference: <a href="https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana" target="_blank" rel="noreferrer">Circle’s devnet USDC documentation</a>.</p>}</section>)}</article></div></main><Footer/></>}
const paper=[['Problem','Payment requests need a clear relationship between what was requested and what settled. Wallet transfers alone do not provide a merchant-facing payment lifecycle, reliable intent correlation, or an intelligible checkout. AUNO adds a request and verification layer while leaving signing and asset custody with the payer’s wallet.'],['Payment model','A merchant signs the creation of an immutable payment intent. The database stores the recipient, asset, amount in base units, expiry, and lifecycle. Checkout loads this record instead of trusting query parameters. A payer reviews those facts and signs a transaction constructed on the server. A unique memo associates the intent with one prepared attempt.'],['Payment links and checkout','Payment links identify persisted requests. SOL transfers use the System Program. USDC transfers use the configured Circle devnet mint and SPL Token transferChecked. Recipient token-account creation is explicit and idempotent. No AUNO token is required. The application remains devnet-only and requires real wallet end-to-end acceptance tests before it can be described as a working payment product.'],['Verification and receipts','The server retrieves finalized transactions from the configured Solana RPC. It checks successful execution, payer signature, payment memo, exact prepared message, asset, amount, and destination. USDC verification additionally checks mint, decimals, the derived token account, and recorded owner. Unique signature constraints and conditional updates make receipt creation idempotent. RPC trust, network availability, and operational controls remain part of the security model.'],['Programmable splits','The allocation model uses basis points totaling 10,000. Base-unit arithmetic avoids floating-point settlement errors. The calculator exposes deterministic rounding. Live multi-recipient settlement is planned after standard payments pass real acceptance testing. Every transfer must fit in one atomic transaction, and verification must confirm every recipient before PAID.'],['Merchant and developer layers','The merchant interface includes payment creation and wallet-authorized history. Internal modules separate asset configuration, amount arithmetic, persistence, wallet interaction, preparation, submission, and verification. A future SDK may expose intent creation, checkout URLs, status, and verification helpers. A public API, SDK, and webhooks are not launched in this release.'],['Architecture','The interface uses React, TypeScript, and a Next-compatible Vinext application. Cloudflare Workers run request handlers; D1 stores payment and attempt records. Wallet Standard exposes signing. Solana RPC provides blockhashes, submission, transaction data, and confirmation status. The application holds no private keys and deploys no custom custody program.'],['Security and limitations','Merchant requests are signed and origin-bound. Stored payment facts remain immutable. Prepared messages cannot be replaced by the client. Receipt state is server-authoritative, and finalized verification is required. These protections do not remove the need for a security audit, concurrency review, robust rate limits, backups, and recovery exercises. Public/private Site access may restrict who can open shared links.'],['Escrow and milestones','Escrow and milestones remain planned. Any future program needs explicit release and refund authority, timeout semantics, audited state transitions, and carefully designed PDA vaults. They are not represented by the native payment engine and must not be marketed as currently available.'],['Recurring payments and the ecosystem','Recurring payment consent and wallet authorization remain research topics. $AUNO is a proposed ecosystem token; this release verifies no launch, contract address, or token utility. Payment customers do not need to hold $AUNO. No returns, revenue share, buybacks, burns, rewards, or token investment outcomes are promised.'],['Roadmap and conclusion','The roadmap progresses from payment foundations to programmable payments, developer tooling, escrow research, and broader integrations. Each phase depends on evidence from implementation and testing. AUNO aims to make value movement understandable and programmable. The present artifact is a developer preview with production work and real devnet acceptance tests still outstanding.']];
export function Whitepaper(){return <><Nav/><main className="page-shell"><div className="eyebrow">AUNO WHITEPAPER / v1.0 DRAFT</div><h1>Programmable payments<br/>on Solana.</h1><p>Implementation-aligned draft · September 2026</p><div className="notice">Prepared from the supplied product master brief. A separate original Whitepaper v1.0 was not supplied. This draft describes the implementation and its limitations; it is not a claim of audited or production-ready infrastructure.</div><div className="docs-layout"><aside className="docs-nav">{paper.map((x,i)=><a key={x[0]} href={'#paper-'+i}>{x[0]}</a>)}</aside><article>{paper.map((x,i)=><section className="doc-section" id={'paper-'+i} key={x[0]}><h2>{String(i+1).padStart(2,'0')} / {x[0]}</h2><p>{x[1]}</p></section>)}</article></div></main><Footer/></>}
const developerCapabilities = [
  { title: "Payment Links", status: "Available", description: "Create and share immutable devnet payment requests.", href: "/dashboard/create" },
  { title: "Checkout & Verification", status: "Preview", description: "Wallet signing and server-verified receipts on Solana Devnet.", href: "/docs#checkout-flow" },
  { title: "Split Payment", status: "Preview", description: "Deterministic allocation and rounding preview; live settlement is planned.", href: "/split" },
  { title: "Public API & SDK", status: "Planned", description: "Stable external API access and an installable SDK are not released.", href: "/roadmap" },
  { title: "Webhooks", status: "Planned", description: "Event delivery for payment lifecycle updates is not released.", href: "/roadmap" },
  { title: "Escrow & Milestones", status: "Planned", description: "Conditional release flows require dedicated authority and audit work.", href: "/roadmap" },
  { title: "Subscriptions", status: "Planned", description: "Recurring wallet-authorized payment flows remain future work.", href: "/roadmap" },
] as const;

export function Developers({ network }: { network?: "mainnet" }) {
  const mainnet = network === "mainnet";
  const capabilities = mainnet ? [
    { ...developerCapabilities[0], status: "Mainnet Beta", description: "Create and share immutable Mainnet Beta SOL payment requests." },
    { ...developerCapabilities[1], status: "Mainnet Beta", description: "Wallet-managed signing and finalized server-verified receipts on Solana Mainnet." },
    { ...developerCapabilities[2], status: "Feature policy", description: "Multi-recipient SOL settlement is available only when the Mainnet split policy is active." },
    ...developerCapabilities.slice(3),
  ] : developerCapabilities;
  return (
    <>
      <Nav network={network} />
      <main className="page-shell developers-page">
        <header className="developer-page-header">
          <div className="eyebrow">{mainnet ? "MAINNET BETA" : "DEVELOPER PREVIEW"}</div>
          <h1>A clear path from<br />intent to settlement.</h1>
          <p>{mainnet ? "Mainnet Beta payment primitives with finalized settlement verification." : "Internal payment primitives today. A stable public developer platform next."}</p>
        </header>

        <div className="notice">@auno/sdk is not published. These internal endpoints power the application and may change. Origin checks and signed wallet messages apply; there is no public API key product. {mainnet && "Mainnet features remain subject to the active settlement and split-release policies."}</div>

        <section className="developer-capabilities" aria-labelledby="platform-capabilities-title">
          <div className="developer-capabilities-heading">
            <div>
              <div className="eyebrow">PLATFORM STATUS</div>
              <h2 id="platform-capabilities-title">What is available now.</h2>
            </div>
            <p>Each capability is labeled by its current release state so implementation plans are not presented as live product features.</p>
          </div>
          <div className="developer-capability-matrix">
            {capabilities.map((capability) => (
              <a className="developer-capability" href={capability.href} key={capability.title}>
                <span className="developer-capability-status" data-status={capability.status}>{capability.status}</span>
                <div>
                  <strong>{capability.title}</strong>
                  <span>{capability.description}</span>
                </div>
                <FiArrowRight className="inline-icon action-icon" aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        <div className="table-wrap developer-endpoint-table">
          <table>
            <thead><tr><th>Endpoint</th><th>Purpose</th><th>Access</th></tr></thead>
            <tbody>{[
              ["POST /api/payments", "Create an immutable intent", "Signed merchant payload"],
              ["GET /api/payments?wallet=…", "List up to 200 merchant payments", "Signed history authorization"],
              ["GET /api/payments/:id", "Load checkout or receipt", "Site access + link ID"],
              ["POST /api/payments/:id/prepare", mainnet ? "Build Mainnet Beta transaction" : "Build devnet transaction", "Same origin; active intent"],
              ["POST /api/payments/:id/submit", "Record wallet-broadcast transaction", "Same origin; valid payer signature"],
              ["POST /api/payments/:id/verify", "Verify finalized settlement", "Same origin; associated signature"],
              ["GET /api/health", mainnet ? "Check storage and Mainnet RPC" : "Check storage and devnet RPC", "Site access"],
            ].map((endpoint) => <tr key={endpoint[0]}>{endpoint.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>

        <section className="doc-section">
          <h2>Payment intent</h2>
          <pre>{'type PaymentIntent = {\n  id: string;\n  merchantWallet: string;\n  title: string;\n  asset: "SOL" | "USDC";\n  amount: string;\n  amountBaseUnits: string; // integer; never a float\n  recipients: PaymentRecipient[];\n  expiresAt: number;\n  status: PaymentStatus;\n  transactionSignature: string | null;\n};'}</pre>
        </section>

        <section className="doc-section">
          <h2>Settlement contract</h2>
          <p>Browser state is not settlement truth. A receipt requires finalized RPC verification against the stored payment intent, per-attempt memo, expected transfer, payer, recipient, and permitted instructions. A retry of the same verified signature returns the existing receipt. Never implement success with a timer or trust a client-provided status.</p>
          <a href="/docs#security-model">Read the security model <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></a>
        </section>

        <section className="doc-section" id="platform-status">
          <h2>Platform status</h2>
          <p>Public API, SDK, webhooks, escrow, and subscriptions are not available. The internal engine is {mainnet ? "a bounded Mainnet Beta release." : "a devnet developer preview."} Use the payment UI to exercise the current integration and report failures without sharing keys or seed phrases.</p>
          <a href="/api/health" target="_blank" rel="noreferrer">Check service health <FiExternalLink className="inline-icon action-icon" aria-hidden="true" /></a>
        </section>
      </main>
      <Footer network={network} />
    </>
  );
}
