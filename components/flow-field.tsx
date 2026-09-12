"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  GitBranch,
  Store,
  Users,
  Landmark,
} from "lucide-react";
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
  return (
    <div className="split-visual">
      <div className="split-flow" key={replay}>
        <div className="split-input">
          <span className="currency-circle">$</span>
          <strong>
            100 <small>USDC</small>
          </strong>
          <span>One payment</span>
        </div>
        <div className="split-hub">
          <Logo markOnly />
        </div>
        <svg
          className="split-lines"
          viewBox="0 0 500 280"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g fill="none" stroke="#c3cbe0" strokeWidth="1.5">
            <path d="M65 140H205" />
            <path d="M235 140C290 140 265 45 340 45H390" />
            <path d="M235 140H390" />
            <path d="M235 140C290 140 265 235 340 235H390" />
          </g>
          <circle className="split-dot split-dot-in" r="4" fill="#8e9bc0" />
          <circle className="split-dot split-dot-top" r="4" fill="#8e9bc0" />
          <circle className="split-dot split-dot-mid" r="4" fill="#8e9bc0" />
          <circle className="split-dot split-dot-bottom" r="4" fill="#8e9bc0" />
        </svg>
        <div className="split-destinations">
          {[
            { name: "Merchant", amount: 80, icon: Store },
            { name: "Affiliate", amount: 15, icon: Users },
            { name: "Treasury", amount: 5, icon: Landmark },
          ].map(({ name, amount, icon: Icon }) => (
            <div className="split-recipient" key={name}>
              <Icon size={16} />
              <span>{name}</span>
              <strong>
                {amount}
                <small> USDC</small>
              </strong>
              <Check size={12} />
            </div>
          ))}
        </div>
      </div>
      <button className="split-replay" onClick={() => setReplay(replay + 1)}>
        <GitBranch size={13} /> One instruction. Every destination.{" "}
        <ArrowRight size={13} />
      </button>
    </div>
  );
}
