import Link from "next/link";
import { EditorialPage } from "@/components/editorial-page";
export const metadata = { title: "Documentation" };
export default function Docs() {
  return (
    <EditorialPage
      label="AUNO DOCUMENTATION · PRODUCT PREVIEW"
      title="A clear path from create to checkout."
      description="Everything you need to explore the AUNO preview and understand what is available."
    >
      <div className="article-layout">
        <nav className="article-nav" aria-label="Documentation sections">
          <a href="#getting-started">Getting started</a>
          <a href="#payment-links">Payment links</a>
          <a href="#checkout">Demo checkout</a>
          <a href="#splits">Split payments</a>
          <a href="#storage">Data & storage</a>
          <a href="#availability">Availability</a>
          <a href="#questions">Questions</a>
        </nav>
        <div className="article-content">
          <section id="getting-started">
            <h2>Getting started</h2>
            <p>
              AUNO is a product preview for programmable payments on Solana. You
              can create requests, share checkout links, and explore a simulated
              payment flow. No real wallet connection or blockchain settlement
              is enabled.
            </p>
            <ol>
              <li>
                Open <Link href="/dashboard/create">Create payment</Link> and
                enter a title.
              </li>
              <li>Choose SOL or USDC and a positive amount.</li>
              <li>Enter the recipient’s full public Solana address.</li>
              <li>Create the link, copy it, and open the checkout.</li>
              <li>
                Connect the demo wallet and simulate payment to see the status
                progression.
              </li>
            </ol>
          </section>
          <section id="payment-links">
            <h2>Payment links</h2>
            <p>
              Requests require a title of 1–80 characters, an amount of up to
              nine integer digits, an asset, and a valid 32-byte base58 address.
              USDC accepts up to six decimal places; SOL accepts up to nine.
            </p>
            <p>
              The preview encodes the request into <code>/pay/[id]</code>. Its
              recipient and amount are public. The encoded data is not encrypted
              or signed. Always review checkout details. Malformed requests are
              rejected.
            </p>
          </section>
          <section id="checkout">
            <h2>Demo checkout</h2>
            <p>
              The checkout preserves the asset and amount defined by its
              creator. The sample checkout separately offers 100 USDC and 1 SOL
              as illustrative amounts; there is no exchange-rate conversion.
            </p>
            <p>
              After selecting the demo wallet, the interface simulates awaiting
              signature, submission, confirmation, and completion. The
              downloadable JSON receipt explicitly states that no funds moved
              and that no blockchain confirmation exists.
            </p>
            <p>
              The merchant’s local request is marked “Demo completed” only when
              checkout runs in the same browser. This is not a verified payment
              status.
            </p>
          </section>
          <section id="splits">
            <h2>Split payments</h2>
            <p>
              Enable splitting when creating a payment to add merchant,
              affiliate, and treasury destinations. Each must have a different
              valid Solana address. Shares must be positive whole percentages
              that add up to 100%.
            </p>
            <p>
              The checkout shows all destinations and shares. Splitting is a
              configuration preview only. No split transaction, distribution, or
              program instruction is submitted.
            </p>
          </section>
          <section id="storage">
            <h2>Data & storage</h2>
            <p>
              Up to 100 requests are stored in your browser’s local storage.
              There is no account, remote database, or cross-device dashboard
              synchronization. Clearing browser data removes local history. The
              self-contained checkout links remain readable by anyone who has
              the full URL.
            </p>
            <p>
              Do not enter private keys, seed phrases, or confidential
              information. The preview never asks for them.
            </p>
          </section>
          <section id="availability">
            <h2>What is available?</h2>
            <ul>
              <li>
                <strong>Available in demo:</strong> request creation, address
                and amount validation, shareable checkout links, simulated
                payment states, local history, and demo receipts.
              </li>
              <li>
                <strong>Preview:</strong> split configuration and proposed
                developer interfaces.
              </li>
              <li>
                <strong>Not implemented:</strong> wallet signing, live
                transfers, RPC verification, hosted merchant accounts,
                production API, SDK, webhooks, and QR checkout.
              </li>
              <li>
                <strong>Planned or research:</strong> escrow, milestones,
                subscriptions, and payouts.
              </li>
            </ul>
            <p>
              See the <Link href="/roadmap">roadmap</Link> for the full
              direction.
            </p>
          </section>
          <section id="questions">
            <h2>Common questions</h2>
            <details className="faq">
              <summary>Does the demo use real money?</summary>
              <p>
                No. All checkout steps are simulated and no real wallet is
                connected.
              </p>
            </details>
            <details className="faq">
              <summary>Can I share a link with someone else?</summary>
              <p>
                Yes. The URL contains the complete request, so it opens on
                another browser when the website is reachable. A localhost URL
                is only accessible from the machine running the site.
              </p>
            </details>
            <details className="faq">
              <summary>Is the SDK ready to install?</summary>
              <p>
                No. Code examples describe a proposed API. There is currently no
                AUNO SDK package or live developer endpoint.
              </p>
            </details>
            <details className="faq">
              <summary>Where is the $AUNO token contract?</summary>
              <p>
                No verified token contract was supplied. The ecosystem section
                is marked Coming Soon and does not publish an address.
              </p>
            </details>
          </section>
        </div>
      </div>
    </EditorialPage>
  );
}
