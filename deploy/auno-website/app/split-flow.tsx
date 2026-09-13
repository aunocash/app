"use client";

import { useEffect, useRef, useState } from 'react';

const recipients = [
  { amount: '80', role: 'Merchant', color: '#526ea9', route: 'M300 204 C300 254 100 242 100 306' },
  { amount: '15', role: 'Affiliate', color: '#8874ad', route: 'M300 204 L300 306' },
  { amount: '5', role: 'Treasury', color: '#518998', route: 'M300 204 C300 254 500 242 500 306' },
];

export function SplitFlow() {
  const container = useRef<HTMLElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      const stopped = paused || !visible || document.hidden || motion.matches;
      if (stopped) svg.current?.pauseAnimations();
      else svg.current?.unpauseAnimations();
      container.current?.setAttribute('data-stopped', String(stopped));
    };
    update();
    motion.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      motion.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [paused, visible, replay]);

  return (
    <figure ref={container} className="split-flow" aria-label="Illustration: one payment of 100 USDC enters AUNO and splits into 80 USDC for the merchant, 15 USDC for the affiliate, and 5 USDC for the treasury.">
      <div className="sf-heading"><span>ONE PAYMENT. THREE DESTINATIONS.</span><span className="badge">ANIMATED PREVIEW</span></div>
      <div key={replay} className="sf-animation">
        <div className="sf-routing">
          <div className="sf-source"><span className="sf-coin">$</span><div><small>Incoming payment</small><strong>100 <span>USDC</span></strong></div></div>
          <svg ref={svg} className="sf-paths" viewBox="0 0 600 310" preserveAspectRatio="none" aria-hidden="true">
            <path className="sf-incoming-track" d="M300 82 L300 140" />
            {recipients.map(r => <path key={r.role} d={r.route} fill="none" stroke={r.color} strokeWidth="2.5" opacity=".5" />)}
            <g className="sf-incoming-packet" opacity="0">
              <circle r="11" fill="#dce5f7" /><circle r="5.5" fill="#506ca6" />
              <animateMotion path="M300 84 L300 140" dur="8s" keyPoints="0;0;1;1" keyTimes="0;.08;.29;1" calcMode="linear" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.07;.27;.30;1" dur="8s" repeatCount="indefinite" />
            </g>
            {recipients.map(r => <g key={r.role} className="sf-outgoing-packet" opacity="0">
              <circle r="11" fill={r.color} opacity=".14" /><circle r="5.5" fill={r.color} />
              <animateMotion path={r.route} dur="8s" keyPoints="0;0;1;1" keyTimes="0;.37;.7;1" calcMode="linear" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.36;.38;.68;.72;1" dur="8s" repeatCount="indefinite" />
            </g>)}
            {recipients.map((r,i) => <circle key={r.role} cx={100+i*200} cy="306" r="3.5" fill={r.color} />)}
          </svg>
          <div className="sf-hub"><img className="sf-hub-logo" src="/auno-logo.png" alt="" width="34" height="34"/><span>AUNO</span><small>Split routing</small></div>
          <span className="sf-percent sf-percent-merchant">80%</span><span className="sf-percent sf-percent-affiliate">15%</span><span className="sf-percent sf-percent-treasury">5%</span>
        </div>
        <div className="sf-recipients">{recipients.map(r => <div key={r.role} className={'sf-recipient sf-'+r.role.toLowerCase()} style={{'--recipient-color':r.color} as React.CSSProperties}><span className="sf-recipient-role"><i/>{r.role}</span><strong>{r.amount}<span> USDC</span></strong><small>of the 100 USDC payment</small></div>)}</div>
        <div className="sf-summary"><span>80 + 15 + 5 USDC</span><strong>100 USDC allocated</strong></div>
      </div>
      <figcaption className="sf-footer"><span>Illustrative flow · No funds moved</span><div className="sf-controls"><button type="button" onClick={()=>setPaused(!paused)} aria-pressed={paused}>{paused?'▶ Play':'Ⅱ Pause'}</button><button type="button" onClick={()=>{setReplay(replay+1);setPaused(false)}} aria-label="Replay split payment animation">↻ Replay</button></div></figcaption>
    </figure>
  );
}
