"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
export function Logo({ markOnly = false }: { markOnly?: boolean }) {
  return (
    <span className="brand">
      <svg
        className="brand-mark"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 27 13 6a3.2 3.2 0 0 1 6 0l9 21h-7l-5-13-5 13H4Z"
          fill="currentColor"
        />
        <path
          d="m12 23 4-5 4 5"
          stroke="var(--background, #fafaf8)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      {!markOnly && <span>AUNO</span>}
    </span>
  );
}
export function SolanaMark() {
  return (
    <span className="solana-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="container nav-inner">
        <Link href="/" aria-label="AUNO home">
          <Logo />
        </Link>
        <nav
          className={open ? "main-nav is-open" : "main-nav"}
          aria-label="Main navigation"
        >
          <Link href="/#product" onClick={() => setOpen(false)}>
            Product
          </Link>
          <Link href="/developers" onClick={() => setOpen(false)}>
            Developers
          </Link>
          <Link href="/docs" onClick={() => setOpen(false)}>
            Docs
          </Link>
          <Link href="/roadmap" onClick={() => setOpen(false)}>
            Roadmap
          </Link>
        </nav>
        <Link className="button nav-cta" href="/dashboard">
          Launch App <ArrowUpRight size={15} />
        </Link>
        <button
          className="menu-toggle"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer container">
      <div className="footer-top">
        <div>
          <Link href="/" aria-label="AUNO home">
            <Logo />
          </Link>
          <p>Programmable Payments on Solana.</p>
        </div>
        <div className="footer-links">
          <Link href="/#product">Product</Link>
          <Link href="/developers">Developers</Link>
          <Link href="/docs">Docs</Link>
          <Link href="/roadmap">Roadmap</Link>
          <Link href="/whitepaper">Whitepaper</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} AUNO</span>
        <span>Designed for value in motion.</span>
        <span>
          auno.cash <ArrowUpRight size={12} />
        </span>
      </div>
    </footer>
  );
}
