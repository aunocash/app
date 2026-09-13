"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FilePlus2, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WalletButton } from "./wallet-button";

const items = [
  { href: "/dashboard", title: "Overview", icon: BarChart3 },
  { href: "/dashboard/create", title: "Create payment", icon: FilePlus2 },
  { href: "/dashboard/payments", title: "Payment history", icon: History },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-[var(--product-line)] pb-4" aria-label="Dashboard navigation">
      <div className="flex flex-wrap items-center gap-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Button key={item.href} variant={active ? "secondary" : "ghost"} size="sm" className="gap-2 text-[var(--product-ink)]" render={<Link href={item.href} aria-current={active ? "page" : undefined} />}>
              <Icon size={15} /> {item.title}
            </Button>
          );
        })}
      </div>
      <span className="ml-auto"><WalletButton mode="merchant" /></span>
    </nav>
  );
}