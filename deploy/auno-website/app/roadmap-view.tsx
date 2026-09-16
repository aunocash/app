import { FiArrowRight, FiCheckCircle, FiCode, FiCreditCard, FiFileText, FiGitBranch, FiLock, FiRefreshCw, FiSettings, FiSliders, FiZap } from "react-icons/fi";
import type { IconType } from "react-icons";
import { Footer, Nav } from "./ui";

type RoadmapPhase = {
  number: string;
  title: string;
  status: "Developer Preview" | "In Development" | "Planned" | "Future" | "Long-Term Direction";
  summary: string;
  capabilities: string[];
  icon: IconType;
};

const roadmapPhases: RoadmapPhase[] = [
  { number: "01", title: "Core Payments", status: "Developer Preview", summary: "A clear foundation for creating, signing, and verifying onchain payment requests.", capabilities: ["Payment Links", "SOL and USDC Checkout", "Transaction Verification", "Merchant Payment History"], icon: FiCreditCard },
  { number: "02", title: "Split Payments", status: "In Development", summary: "Route one payment to multiple recipients with allocation logic and verified receipts.", capabilities: ["Split Settlement", "Multiple Recipients", "Verified Receipts", "Payment Management"], icon: FiGitBranch },
  { number: "03", title: "Escrow & Milestones", status: "Planned", summary: "Secure funds before settlement and release them through explicit milestone approval.", capabilities: ["Escrow", "Milestones", "Approval Flow", "Conditional Release"], icon: FiLock },
  { number: "04", title: "Payment Streaming", status: "Planned", summary: "Support continuous, time-based settlement for contributors, payroll, and recurring compensation.", capabilities: ["Continuous Payments", "Payroll", "Contributor Payments", "Time-Based Settlement"], icon: FiRefreshCw },
  { number: "05", title: "Conditional Payments", status: "Planned", summary: "Connect payment outcomes to defined rules, conditions, and events.", capabilities: ["Rules", "Conditions", "Events", "Automated Settlement"], icon: FiSliders },
  { number: "06", title: "Subscriptions", status: "Planned", summary: "Create recurring payment authorization for scheduled settlement and memberships.", capabilities: ["Recurring Payments", "Authorization", "Scheduled Settlement", "Memberships"], icon: FiRefreshCw },
  { number: "07", title: "AUNO Invoice", status: "Planned", summary: "Turn payment requests into merchant-ready invoices with due dates and clear status.", capabilities: ["Invoices", "Due Dates", "Payment Status", "Merchant Tools"], icon: FiFileText },
  { number: "08", title: "Programmable Revenue Split", status: "Future", summary: "Make reusable payment distribution logic part of the settlement layer.", capabilities: ["Reusable Distribution Logic", "Allocation Rules", "Settlement Receipts"], icon: FiGitBranch },
  { number: "09", title: "Developer Infrastructure", status: "Future", summary: "Extend AUNO from an application into dependable tooling for product teams.", capabilities: ["API", "SDK", "Webhooks", "Integration Tools"], icon: FiCode },
  { number: "10", title: "Payment Automation Engine", status: "Long-Term Direction", summary: "Compose payment automation as explicit WHEN, CONDITION, and ACTION workflows.", capabilities: ["WHEN", "CONDITION", "ACTION", "Settlement Execution"], icon: FiSettings },
];

function StatusBadge({ status }: { status: RoadmapPhase["status"] }) {
  const statusClass = status.toLowerCase().replaceAll(" ", "-");
  return <span className={`roadmap-status roadmap-status-${statusClass}`}>{status}</span>;
}

function FoundationFlow() {
  return <section className="roadmap-proof" aria-label="AUNO core payment flow"><div className="roadmap-proof-copy"><div className="eyebrow">CURRENT FOUNDATION</div><h2>Payments that know what to do next.</h2><p>Create a verifiable payment today. Build toward programmable settlement as the rules become more powerful.</p><div className="roadmap-proof-status"><FiCheckCircle aria-hidden="true" /> Settlement logic stays explicit and verifiable.</div></div><div className="roadmap-flow-panel"><div className="roadmap-flow-label"><span>CORE PAYMENT FLOW</span><StatusBadge status="Developer Preview" /></div><div className="roadmap-flow"><div className="roadmap-flow-step"><small>01</small><strong>Payment intent</strong><span>Link created</span></div><FiArrowRight className="roadmap-flow-arrow" aria-hidden="true" /><div className="roadmap-flow-step roadmap-flow-step-active"><small>02</small><strong>Wallet signing</strong><span>Customer approves</span></div><FiArrowRight className="roadmap-flow-arrow" aria-hidden="true" /><div className="roadmap-flow-step"><small>03</small><strong>Verified receipt</strong><span>Settlement checked</span></div></div><div className="roadmap-flow-footer"><span>USDC · DEVNET</span><span>Intent → settlement</span></div></div></section>;
}

export function Roadmap() {
  return <><Nav /><main className="page-shell roadmap-page"><header className="roadmap-hero"><div className="eyebrow">THE AUNO ROADMAP <span className="badge">FUNCTIONALITY OVER DATES</span></div><h1>From payment intent to programmable settlement.</h1><p>AUNO starts with simple, verifiable onchain payments and progressively evolves toward split settlement, automation, and developer infrastructure on Solana.</p><div className="roadmap-hero-meta"><span><FiZap aria-hidden="true" /> 10 product directions</span><span><FiCheckCircle aria-hidden="true" /> No promised launch dates</span></div></header><FoundationFlow /><section className="roadmap-sequence" aria-labelledby="roadmap-sequence-title"><div className="roadmap-sequence-intro"><div className="eyebrow">THE EVOLUTION</div><h2 id="roadmap-sequence-title">A deliberate path forward.</h2><p>Each phase follows verified functionality. Statuses show direction without presenting future capabilities as available today.</p><div className="roadmap-legend"><span><i className="roadmap-legend-dot roadmap-legend-dot-active" /> Current foundation</span><span><i className="roadmap-legend-dot" /> Planned direction</span></div></div><div className="roadmap-list"><div className="roadmap-rail" aria-hidden="true"><span /></div>{roadmapPhases.map((phase) => { const Icon = phase.icon; return <article className={`roadmap-node roadmap-node-${phase.status.toLowerCase().replaceAll(" ", "-")}`} key={phase.number}><div className="roadmap-node-index"><span>{phase.number}</span><Icon aria-hidden="true" /></div><div className="roadmap-node-body"><div className="roadmap-node-heading"><div><div className="roadmap-node-kicker">PHASE {phase.number}</div><h3>{phase.title}</h3></div><StatusBadge status={phase.status} /></div><p>{phase.summary}</p><div className="roadmap-capabilities">{phase.capabilities.map((capability) => <span key={capability}><FiCheckCircle aria-hidden="true" />{capability}</span>)}</div></div></article>; })}</div></section><section className="roadmap-note"><FiZap aria-hidden="true" /><div><strong>Direction, not a deadline.</strong><p>AUNO tracks progress by working functionality. Future phases remain subject to implementation, testing, security review, and explicit release decisions.</p></div></section></main><Footer /></>;
}