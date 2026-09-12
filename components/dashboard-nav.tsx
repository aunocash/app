"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="app-navigation" aria-label="Dashboard navigation">
      {[
        { href: "/dashboard", title: "Overview" },
        { href: "/dashboard/create", title: "Create payment" },
        { href: "/dashboard/payments", title: "Payment history" },
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href ? "active" : ""}
          aria-current={pathname === item.href ? "page" : undefined}
        >
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
