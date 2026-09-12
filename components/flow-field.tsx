"use client";

import { useState } from "react";
import { ArrowRight, GitBranch } from "lucide-react";
import { Logo } from "./site-shell";

export function FlowField() {
  return (
    <div className="flow-field" aria-hidden="true">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <svg viewBox="0 0 1440 760" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="route-gradient">
            <stop stopColor="#c5cde9" stopOpacity="0" />
            <stop offset=".5" stopColor="#a6b2d6" stopOpacity=".7" />
            <stop offset="1" stopColor="#b8bee5" stopOpacity=".1" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#route-gradient)" strokeWidth="1">
          <path d="M420 660C700 620 560 160 950 210S1300 400 1480 120" />
          <path d="M460 720C830 650 650 340 1030 370S1350 610 1500 520" />
          <path d="M550 740C820 730 770 460 1100 480S1370 200 1500 290" />
          <path d="M780 0C680 170 850 240 1060 230S1250 580 1450 640" />
        </g>
        <g fill="#939fc4">
          <circle className="flow-particle particle-one" r="3" />
          <circle className="flow-particle particle-two" r="3" />
          <circle className="flow-particle particle-three" r="2" />
          <circle cx="787" cy="583" r="2" />
          <circle cx="1335" cy="164" r="2" />
          <circle cx="615" cy="463" r="1.5" />
        </g>
      </svg>
    </div>
  );
}

export function SplitPaymentVisualizer() {
  const [replay, setReplay] = useState(0);
  const destinations = [
    { name: "Merchant", amount: 80 },
    { name: "Affiliate", amount: 15 },
    { name: "Treasury", amount: 5 },
  ];

  return (
    <div className="split-visual">
      <div className="split-flow" key={replay}>
        <div className="split-input">
          <span>ONE PAYMENT</span>
          <strong>
            100 <small>USDC</small>
          </strong>
        </div>
        <div className="split-hub">
          <Logo markOnly />
        </div>
        <svg
          className="split-lines"
          viewBox="0 0 720 320"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M118 160H293" />
            <path d="M357 160C426 160 420 60 503 60H568" />
            <path d="M357 160H568" />
            <path d="M357 160C426 160 420 260 503 260H568" />
          </g>
          <g className="split-motion" fill="currentColor">
            <circle className="split-dot split-dot-input" r="4">
              <animateMotion
                dur="2.6s"
                path="M118 160H293"
                repeatCount="indefinite"
              />
            </circle>
            <circle className="split-dot" r="4.5">
              <animateMotion
                begin="0.65s"
                dur="3.1s"
                path="M357 160C426 160 420 60 503 60H568"
                repeatCount="indefinite"
              />
            </circle>
            <circle className="split-dot" r="4.5">
              <animateMotion
                begin="0.9s"
                dur="2.9s"
                path="M357 160H568"
                repeatCount="indefinite"
              />
            </circle>
            <circle className="split-dot" r="4.5">
              <animateMotion
                begin="1.15s"
                dur="3.1s"
                path="M357 160C426 160 420 260 503 260H568"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        </svg>
        <div className="split-destinations">
          {destinations.map(({ name, amount }) => (
            <div className="split-recipient" key={name}>
              <span>{name}</span>
              <strong>
                {amount}
                <small> USDC</small>
              </strong>
            </div>
          ))}
        </div>
      </div>
      <button className="split-replay" onClick={() => setReplay(replay + 1)}>
        <GitBranch size={13} /> Restart the payment flow{" "}
        <ArrowRight size={13} />
      </button>
    </div>
  );
}
