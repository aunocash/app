import Link from "next/link";
import { ArrowUpRight, Info } from "lucide-react";
import { EditorialPage } from "@/components/editorial-page";
import { DeveloperCodeBlock } from "@/components/content";
export const metadata = { title: "Developers" };
export default function Developers() {
  return (
    <EditorialPage
      label="DEVELOPER PREVIEW"
      title="Build your next payment flow."
      description="A considered developer experience for programmable payments on Solana."
    >
      <div className="notice">
        <Info size={16} />
        <span>
          The API and SDK are proposed interfaces, not released services. No API
          keys, public endpoints, or packages are available yet.
        </span>
      </div>
      <div className="developer-grid">
        <div>
          <h2>
            Small surface.
            <br />
            <span>Big possibilities.</span>
          </h2>
          <p>
            Our proposed API brings payment requests, checkout, and routing into
            one consistent interface. Explore the product today and follow the
            developer layer as it takes shape.
          </p>
          <div className="button-row">
            <Link href="/docs" className="button primary">
              Read the Docs <ArrowUpRight size={15} />
            </Link>
            <Link href="/roadmap" className="button text-button">
              View roadmap <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
        <DeveloperCodeBlock />
      </div>
      <div className="article-content" style={{ marginTop: 65 }}>
        <section>
          <h2>What you can explore today</h2>
          <p>
            Create a validated payment request in the{" "}
            <Link href="/dashboard/create">payment workspace</Link>, open its
            shareable checkout, and step through simulated payment states. This
            preview runs without a wallet, RPC connection, or credentials.
          </p>
        </section>
        <section>
          <h2>The planned integration surface</h2>
          <ul>
            <li>
              <strong>Payment requests:</strong> create and retrieve requests
              with explicit amounts, assets, and recipients.
            </li>
            <li>
              <strong>Verification:</strong> associate a transaction with a
              request and verify settlement on Solana.
            </li>
            <li>
              <strong>Webhooks:</strong> deliver signed payment updates with
              retries and idempotency.
            </li>
            <li>
              <strong>SDK:</strong> typed tools for integrating checkout into
              your application.
            </li>
          </ul>
          <p>
            Authentication, endpoint contracts, versioning, and delivery
            guarantees remain to be specified. These features are planned.
          </p>
        </section>
      </div>
    </EditorialPage>
  );
}
