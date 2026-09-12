import Link from "next/link";
import { EditorialPage } from "@/components/editorial-page";
export const metadata = { title: "Protocol overview" };
export default function Whitepaper() {
  return (
    <EditorialPage
      label="CONCEPT OVERVIEW · PRELIMINARY"
      title="Value in motion."
      description="AUNO’s product direction for programmable payments on Solana."
    >
      <div className="notice">
        This is a preliminary product overview, not a finalized protocol
        whitepaper, audited specification, or token offering.
      </div>
      <div className="article-content">
        <section>
          <h2>Payments as a programmable primitive</h2>
          <p>
            AUNO’s intended role is to help merchants and developers define how
            payments are requested, approved, routed, and verified. A payment
            request brings together a title, amount, asset, and recipient; a
            checkout provides the payer with a clear review and approval
            experience.
          </p>
        </section>
        <section>
          <h2>Non-custodial by design</h2>
          <p>
            The intended settlement model is wallet to wallet. AUNO should not
            require users to surrender private keys or hold balances in a
            custodial account. A production implementation still requires
            transaction construction, wallet signing, network submission, and
            independent verification.
          </p>
        </section>
        <section>
          <h2>Routing value</h2>
          <p>
            Split payments extend a request with explicitly defined recipients
            and allocations. Escrow and milestone modules would introduce
            conditional release rules. Their contracts, authorities, and failure
            recovery need to be specified and reviewed before any real funds are
            accepted.
          </p>
        </section>
        <section>
          <h2>The current implementation</h2>
          <p>
            This release demonstrates request creation, shared checkout, split
            configuration, local merchant history, and simulated transaction
            states. It does not submit transactions, verify settlement, or
            provide an on-chain program. Local completion is a demo marker and
            cannot be used as evidence of payment.
          </p>
        </section>
        <section>
          <h2>The ecosystem</h2>
          <p>
            $AUNO is the ecosystem token associated with AUNO. No verified
            launch, contract, token utility, supply, or distribution details are
            published in this preview. No financial return or investment
            performance is promised.
          </p>
        </section>
        <section>
          <h2>Next milestones</h2>
          <p>
            The <Link href="/roadmap">roadmap</Link> separates foundation work
            from planned developer infrastructure and conditional payment
            modules. Published implementation details should follow tested
            functionality.
          </p>
        </section>
      </div>
    </EditorialPage>
  );
}
