import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  CreditCard,
  GitBranch,
  Globe2,
  Link2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import {
  Navbar,
  Footer,
  Logo,
  SolanaMark,
  UsdcMark,
} from "@/components/site-shell";
import { FlowField, SplitPaymentVisualizer } from "@/components/flow-field";
import { PaymentCard } from "@/components/payment-card";
import { LiveDemoButton } from "@/components/live-demo-button";
import { DeveloperCodeBlock, Roadmap } from "@/components/content";
export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <section className="hero">
          <FlowField />
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="status-dot" /> PAYMENT INFRASTRUCTURE FOR
                SOLANA
              </div>
              <h1>
                Money should be
                <br />
                <span>programmable.</span>
              </h1>
              <p>
                Create payment links, accept SOL and USDC,
                <br className="desktop-break" /> and build programmable payment
                flows on Solana.
              </p>
              <div className="button-row">
                <Link className="button primary" href="/dashboard/create">
                  Create a Payment <ArrowUpRight size={17} />
                </Link>
                <Link className="button text-button" href="/developers">
                  Explore Developers <ArrowRight size={16} />
                </Link>
              </div>
              <div className="hero-trust">
                <span>
                  <SolanaMark /> Built on Solana
                </span>
                <span>
                  <ShieldCheck size={14} /> Non-custodial by design
                </span>
                <span>
                  <Code2 size={14} /> Developer-ready
                </span>
              </div>
            </div>
            <div className="hero-product">
              <div className="route-tag source-tag">
                <span className="tiny-avatar">JD</span>
                <span>
                  Customer<small>Payment initiated</small>
                </span>
                <span className="mini-dot" />
              </div>
              <PaymentCard />
              <div className="route-tag settled-tag">
                <span className="route-check">
                  <Check size={15} />
                </span>
                <span>
                  Your wallet<small>Direct settlement</small>
                </span>
                <ArrowUpRight size={16} />
              </div>
              <span className="visual-caption">
                A LITTLE PREVIEW OF WHAT FLOWS NEXT
              </span>
            </div>
          </div>
          <div className="container hero-bottom">
            <span>YOUR PAYMENTS. YOUR RULES.</span>
            <span>
              Built for a world that doesn’t stop.
              <ArrowRight size={14} className="down-arrow" />
            </span>
          </div>
        </section>
        <section
          className="principles container"
          aria-label="Platform benefits"
        >
          <div>
            <Zap />
            <span>
              Move at the speed of Solana
              <small>Fast settlement. Less waiting.</small>
            </span>
          </div>
          <div>
            <LockKeyhole />
            <span>
              Your money stays yours
              <small>Payments go directly to your wallet.</small>
            </span>
          </div>
          <div>
            <Globe2 />
            <span>
              Borderless by default
              <small>One link. Anywhere in the world.</small>
            </span>
          </div>
        </section>
        <section className="section container" id="product">
          <div className="section-heading">
            <div>
              <div className="eyebrow">LESS FRICTION. MORE POSSIBILITIES.</div>
              <h2>
                Simple to start.
                <br />
                <span>Powerful by design.</span>
              </h2>
            </div>
            <p>
              From a single payment to a custom flow.
              <br />
              The building blocks for how money moves.
            </p>
          </div>
          <div className="product-grid">
            <article className="product-panel links-panel">
              <div className="panel-icon">
                <Link2 size={20} />
              </div>
              <h3>
                One link.
                <br />
                Ready to get paid.
              </h3>
              <p>
                Create a payment request in seconds.
                <br />
                Share it anywhere. Get on with your day.
              </p>
              <Link className="inline-link" href="/dashboard/create">
                Create a payment link <ArrowUpRight size={16} />
              </Link>
              <div className="link-preview">
                <div>
                  <span className="mini-logo">
                    <Logo markOnly />
                  </span>
                  <span>
                    Website Development<small>Payment request · USDC</small>
                  </span>
                  <strong>100.00</strong>
                </div>
                <div className="preview-url">
                  <Link2 size={14} />
                  <span>auno.cash/pay/live</span>
                  <Link href="/pay/demo" aria-label="Open live devnet checkout">
                    <ArrowUpRight size={17} />
                  </Link>
                </div>
              </div>
              <span className="corner-caption">01 / PAYMENT LINKS</span>
            </article>
            <article className="product-panel checkout-panel">
              <div className="panel-icon">
                <CreditCard size={20} />
              </div>
              <h3>
                Checkout without
                <br />
                the friction.
              </h3>
              <p>
                A familiar checkout. A better payment rail.
                <br />
                Accept SOL and USDC, wallet to wallet.
              </p>
              <LiveDemoButton className="inline-link">
                Try a live devnet checkout <ArrowUpRight size={16} />
              </LiveDemoButton>
              <div className="checkout-preview">
                <div className="asset-choice">
                  <UsdcMark />
                  <span>
                    USD Coin<small>USDC on Solana</small>
                  </span>
                  <span className="selected-dot" />
                </div>
                <div className="asset-choice">
                  <SolanaMark />
                  <span>
                    Solana<small>SOL</small>
                  </span>
                  <span className="unselected-dot" />
                </div>
                <div className="checkout-foot">
                  <LockKeyhole size={12} /> Your wallet. Your approval.
                </div>
              </div>
              <span className="corner-caption">02 / CHECKOUT</span>
            </article>
          </div>
        </section>
        <section className="split-section container">
          <div className="split-copy">
            <div className="eyebrow">
              <GitBranch size={14} /> BUILT TO BRANCH OUT
            </div>
            <h2>
              One payment.
              <br />
              <span>Multiple destinations.</span>
            </h2>
            <p>
              Define where value goes before the payment happens. Merchant,
              affiliate, treasury — everyone in the flow.
            </p>
            <Link className="inline-link" href="/dashboard/create?mode=split">
              Explore split payments <ArrowUpRight size={16} />
            </Link>
            <span className="soft-label">INTERACTIVE PREVIEW</span>
          </div>
          <SplitPaymentVisualizer />
        </section>
        <section className="section container how-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">THREE STEPS. ZERO DETOURS.</div>
              <h2>From request to received.</h2>
            </div>
          </div>
          <div className="steps">
            {[
              {
                n: "01",
                title: "Create",
                text: "Set your payment amount, asset, and recipient. Your rules start here.",
              },
              {
                n: "02",
                title: "Share",
                text: "Send your AUNO payment link in a message, an invoice, or anywhere else.",
              },
              {
                n: "03",
                title: "Settle",
                text: "Your customer approves in their wallet. Settlement happens on Solana.",
              },
            ].map((step) => (
              <div key={step.n}>
                <span className="step-number">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
          <p className="fine-print">
            Try the live devnet sample. It requests 0.001 SOL only after wallet approval.
          </p>
        </section>
        <section className="developer-section">
          <div className="container developer-grid">
            <div>
              <div className="eyebrow">LESS INTEGRATION. MORE CREATION.</div>
              <h2>
                Built for developers.
                <br />
                <span>Made for what’s next.</span>
              </h2>
              <p>
                Add programmable Solana payments to your product without
                rebuilding payment infrastructure.
              </p>
              <div className="button-row">
                <Link className="button primary" href="/docs">
                  Read the Docs <ArrowUpRight size={16} />
                </Link>
                <Link className="button text-button" href="/developers">
                  Explore API <ArrowRight size={16} />
                </Link>
              </div>
              <span className="soft-label">API & SDK · DEVELOPER PREVIEW</span>
            </div>
            <DeveloperCodeBlock />
          </div>
        </section>
        <section className="section container">
          <div className="section-heading">
            <div>
              <div className="eyebrow">A FOUNDATION. NOT A FINISH LINE.</div>
              <h2>Payments that follow your rules.</h2>
            </div>
            <Link href="/roadmap" className="inline-link">
              See the roadmap <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="module-list">
            {[
              {
                icon: Link2,
                title: "Payment links",
                desc: "Create shareable payment requests.",
                status: "Live devnet",
              },
              {
                icon: CreditCard,
                title: "Checkout",
                desc: "Explore SOL and USDC checkout.",
                status: "Live devnet",
              },
              {
                icon: GitBranch,
                title: "Split payments",
                desc: "Define multiple payment destinations.",
                status: "Preview",
              },
              {
                icon: LockKeyhole,
                title: "Escrow",
                desc: "Release funds when conditions are met.",
                status: "Planned",
              },
              {
                icon: Check,
                title: "Milestones",
                desc: "Connect payments to progress.",
                status: "Planned",
              },
              {
                icon: Timer,
                title: "Subscriptions",
                desc: "Explore recurring payment flows.",
                status: "Research",
              },
            ].map(({ icon: Icon, ...item }) => (
              <article className="feature-row" key={item.title}>
                <Icon size={21} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
                <span className="soft-label">{item.status}</span>
              </article>
            ))}
          </div>
        </section>
        <section className="container roadmap-home">
          <div className="section-heading">
            <div>
              <div className="eyebrow">BUILDING IN THE OPEN</div>
              <h2>The road ahead.</h2>
            </div>
            <p>
              A considered path to programmable payments.
              <br />
              Clear milestones. Honest progress.
            </p>
          </div>
          <Roadmap compact />
        </section>
        <section className="container ecosystem">
          <span className="ecosystem-symbol">
            <Sparkles size={24} />
          </span>
          <div>
            <h3>The AUNO ecosystem.</h3>
            <p>$AUNO is the ecosystem token associated with AUNO.</p>
          </div>
          <span className="soft-label">$AUNO · COMING SOON</span>
        </section>
        <section className="final-cta">
          <div className="eyebrow">VALUE IN MOTION</div>
          <h2>
            Move value <span>your way.</span>
          </h2>
          <p>Create programmable payment flows on Solana.</p>
          <div className="button-row">
            <Link className="button primary" href="/dashboard">
              Launch AUNO <ArrowUpRight size={17} />
            </Link>
            <Link className="button text-button" href="/docs">
              Read the Docs <ArrowRight size={16} />
            </Link>
          </div>
          <div className="final-orbit" aria-hidden="true" />
        </section>
      </main>
      <Footer />
    </>
  );
}
