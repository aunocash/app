import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function DeveloperCodeBlock() {
  return (
    <div className="code-window">
      <div className="code-window-bar">
        <div className="window-dots">
          <i />
          <i />
          <i />
        </div>
        <span>create-payment.ts</span>
        <span>TypeScript</span>
      </div>
      <pre>
        <code>
          <span className="code-comment">
            {"// Your next payment starts here."}
          </span>
          {"\n\n"}
          <span className="code-purple">const</span>
          {" payment = "}
          <span className="code-purple">await</span>
          {" auno.payments."}
          <span className="code-blue">create</span>
          {"({\n  amount: "}
          <span className="code-string">&quot;100&quot;</span>
          {",\n  asset: "}
          <span className="code-string">&quot;USDC&quot;</span>
          {",\n  recipient: "}
          <span className="code-string">&quot;8Ks...&quot;</span>
          {"\n});\n\n"}
          <span className="code-purple">return</span>
          {" payment.checkoutUrl;"}
        </code>
      </pre>
      <div className="code-window-footer">
        <span className="mini-dot" /> Proposed SDK · Not yet available{" "}
        <span>Less code. More flow.</span>
      </div>
    </div>
  );
}
const phases = [
  {
    name: "Foundation",
    status: "IN DEVELOPMENT",
    items: [
      "Payment links",
      "SOL & USDC checkout",
      "Payment verification",
      "Merchant dashboard",
    ],
  },
  {
    name: "Programmable payments",
    status: "PLANNED",
    items: [
      "Split payments",
      "Verified receipts",
      "QR checkout",
      "Payment management",
    ],
  },
  {
    name: "Developer layer",
    status: "PLANNED",
    items: ["API & SDK", "Webhooks", "Integrations"],
  },
  {
    name: "Escrow",
    status: "PLANNED",
    items: ["Conditional escrow", "Milestone payments", "Release & refund"],
  },
  {
    name: "Network",
    status: "RESEARCH",
    items: [
      "Subscriptions",
      "Payouts",
      "Additional SPL assets",
      "Protocol integrations",
    ],
  },
];
export function Roadmap({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <div className={compact ? "roadmap-grid compact" : "roadmap-grid"}>
        {(compact ? phases.slice(0, 3) : phases).map((phase, index) => (
          <article className="roadmap-phase" key={phase.name}>
            <div className="phase-top">
              <span>PHASE 0{index + 1}</span>
              <span className="soft-label">{phase.status}</span>
            </div>
            <h3>{phase.name}</h3>
            <ul>
              {phase.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      {compact && (
        <Link className="inline-link roadmap-more" href="/roadmap">
          Explore all five phases <ArrowUpRight size={15} />
        </Link>
      )}
    </>
  );
}
