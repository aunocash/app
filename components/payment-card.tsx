import { LiveDemoButton } from "./live-demo-button";
import { ArrowUpRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { Logo, SolanaMark } from "./site-shell";
export function PaymentCard() {
  return (
    <div className="payment-card">
      <div className="payment-card-header">
        <Logo />
        <span className="preview-badge">LIVE DEVNET</span>
      </div>
      <div className="payment-card-body">
        <span className="payment-service-icon">
          <span />
          <span />
          <span />
          <span />
        </span>
        <p>AUNO Devnet Checkout</p>
        <div className="payment-amount">
          0<span>.001</span> <small>SOL</small>
        </div>
        <span className="network-label">
          <SolanaMark /> on Solana
        </span>
        <div className="recipient-line">
          <span>Recipient</span>
          <span>
            <span className="recipient-avatar" />
            Devnet wallet <ArrowUpRight size={12} />
          </span>
        </div>
        <LiveDemoButton className="button primary payment-button">
          <SolanaMark /> Start 0.001 SOL sample <ArrowUpRight size={15} />
        </LiveDemoButton>
        <div className="payment-security">
          <LockKeyhole size={11} /> Launch a live devnet sample
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
