import Link from "next/link";
import { ArrowUpRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { Logo, SolanaMark } from "./site-shell";
export function PaymentCard() {
  return (
    <div className="payment-card">
      <div className="payment-card-header">
        <Logo />
        <span className="preview-badge">DEMO PREVIEW</span>
      </div>
      <div className="payment-card-body">
        <span className="payment-service-icon">
          <span />
          <span />
          <span />
          <span />
        </span>
        <p>Website Development</p>
        <div className="payment-amount">
          100<span>.00</span> <small>USDC</small>
        </div>
        <span className="network-label">
          <SolanaMark /> on Solana
        </span>
        <div className="recipient-line">
          <span>Recipient</span>
          <span>
            <span className="recipient-avatar" />
            8Ks...91Q <ArrowUpRight size={12} />
          </span>
        </div>
        <Link href="/pay/demo" className="button primary payment-button">
          <span className="usdc-mini">$</span> Pay with USDC{" "}
          <ArrowUpRight size={15} />
        </Link>
        <div className="payment-security">
          <LockKeyhole size={11} /> Explore a demo · No funds moved
        </div>
      </div>
      <div className="payment-card-footer">
        <ShieldCheck size={13} />
        <span>Wallet to wallet. Always.</span>
        <span className="mini-dot" />
      </div>
    </div>
  );
}
