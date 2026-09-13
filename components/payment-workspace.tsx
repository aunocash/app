"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, CircleAlert, Inbox, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client/api";
import type { Asset, PaymentStatus } from "@/lib/contracts/payments";
import { paymentStatusPresentation } from "@/lib/client/payment-ui";

const statuses: PaymentStatus[] = [
  "ACTIVE",
  "AWAITING_SIGNATURE",
  "SUBMITTED",
  "CONFIRMING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
];

function date(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function PaymentWorkspace({ overview = false }: { overview?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [asset, setAsset] = useState<Asset | "">(() => (searchParams.get("asset") as Asset | null) ?? "");
  const [status, setStatus] = useState<PaymentStatus | "">(() => (searchParams.get("status") as PaymentStatus | null) ?? "");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (overview) return;
    const next = new URLSearchParams();
    if (deferredSearch) next.set("search", deferredSearch);
    if (asset) next.set("asset", asset);
    if (status) next.set("status", status);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [asset, deferredSearch, overview, pathname, router, status]);

  const reducedMotion = useReducedMotion();
  const filters = { search: deferredSearch || undefined, asset: asset || undefined, status: status || undefined, limit: overview ? 5 : 20 };
  const payments = useInfiniteQuery({
    queryKey: ["payments", filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.payments({ ...filters, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const summary = useQuery({ queryKey: ["payment-summary"], queryFn: api.summary, enabled: overview });
  const items = payments.data?.pages.flatMap((page) => page.items) ?? [];
  const hasFilters = Boolean(search || asset || status);

  return (
    <section className="workspace-section" aria-labelledby={overview ? "workspace-overview" : "payment-history"}>
      {overview && (
        <>
          <div className="workspace-heading">
            <div>
              <div className="eyebrow">DEVNET PAYMENT OPERATIONS</div>
              <h2 id="workspace-overview">Move from link to finality.</h2>
            </div>
            <Button className="button primary" render={<Link href="/dashboard/create" />}><Plus size={16} /> Create payment <ArrowUpRight size={15} /></Button>
          </div>
          <div className="stat-grid live-stats">
            {[{ label: "All requests", value: summary.data?.total }, { label: "Ready now", value: summary.data?.active }, { label: "Verified", value: summary.data?.paid }].map((stat) => (
              <Card key={stat.label} className="stat border-[var(--product-line)] bg-[#fffefa] shadow-none">
                <CardHeader className="p-4 pb-1"><span>{stat.label}</span></CardHeader>
                <CardContent className="p-4 pt-1"><CardTitle className="text-3xl text-[var(--product-ink)]">{summary.isPending ? "—" : stat.value ?? 0}</CardTitle></CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <div className="table-toolbar live-toolbar">
        <div>
          <h2 id={overview ? undefined : "payment-history"}>{overview ? "Recent requests" : "Payment history"}</h2>
          {!overview && <p>Search and filter only the requests owned by this wallet.</p>}
        </div>
        <div className="payment-filters">
          <Input className="search-input" aria-label="Search payments" placeholder="Search title or reference" value={search} onChange={(event) => setSearch(event.target.value)} />
          {!overview && (
            <Select value={asset || null} onValueChange={(value) => setAsset((value ?? "") as Asset | "")}>
              <SelectTrigger aria-label="Filter by asset" className="min-h-10 w-[132px] border-[var(--product-line)] bg-white text-[var(--product-ink)]"><SelectValue placeholder="All assets" /></SelectTrigger>
              <SelectContent><SelectItem value="SOL">SOL</SelectItem><SelectItem value="USDC">USDC</SelectItem></SelectContent>
            </Select>
          )}
          {!overview && (
            <Select value={status || null} onValueChange={(value) => setStatus((value ?? "") as PaymentStatus | "")}>
              <SelectTrigger aria-label="Filter by status" className="min-h-10 w-[170px] border-[var(--product-line)] bg-white text-[var(--product-ink)]"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{paymentStatusPresentation(item).label}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      </div>

      {payments.isPending ? (
        <Skeleton className="table-skeleton" aria-label="Loading payments" />
      ) : payments.isError ? (
        <Card className="empty-state border-[var(--product-line)] bg-[#fffefa]" role="alert">
          <CardContent className="flex flex-col items-center gap-3 p-8"><CircleAlert size={28} /><CardTitle>Payments could not be loaded.</CardTitle><p>Check your session and connection, then try again.</p><Button variant="ghost" type="button" onClick={() => payments.refetch()}><RefreshCw size={15} /> Retry</Button></CardContent>
        </Card>
      ) : items.length ? (
        <motion.div initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="payment-table-wrap overflow-hidden rounded-xl border border-[var(--product-line)] bg-[#fffefa] shadow-[0_5px_16px_rgba(22,32,54,.04)]">
          <Table className="payment-table live-payment-table">
            <TableHeader><TableRow><TableHead>Payment</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Checkout</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((payment) => {
              const presentation = paymentStatusPresentation(payment.status);
              return <TableRow key={payment.id}><TableCell><Link href={`/dashboard/payments/${payment.id}`} className="table-title">{payment.title}</Link><small>{date(payment.createdAt)} · {payment.recipients.length > 1 ? `${payment.recipients.length}-way split` : "Single recipient"}</small></TableCell><TableCell>{payment.amount} {payment.asset}</TableCell><TableCell><Badge variant="outline" className={`status-chip status-${presentation.tone}`}>{presentation.label}</Badge></TableCell><TableCell><Button variant="link" size="sm" className="inline-link" render={<Link href={`/dashboard/payments/${payment.id}`} />}>View <ArrowUpRight size={14} /></Button></TableCell></TableRow>;
            })}</TableBody>
          </Table>
        </motion.div>
      ) : (
        <Card className="empty-state border-[var(--product-line)] bg-[#fffefa]">
          <CardContent className="flex flex-col items-center gap-3 p-8"><Inbox size={30} /><CardTitle>{hasFilters ? "No payments match these filters." : "Your first live payment starts here."}</CardTitle><p>{hasFilters ? "Try a different title, asset, or status." : "Create a Solana devnet request, share its link, and follow it through verification."}</p><Button className="button primary" render={<Link href="/dashboard/create" />}><Plus size={16} /> Create payment</Button></CardContent>
        </Card>
      )}
      {payments.hasNextPage && <Button variant="ghost" className="load-more" type="button" disabled={payments.isFetchingNextPage} onClick={() => payments.fetchNextPage()}>{payments.isFetchingNextPage ? "Loading…" : "Load more payments"}</Button>}
    </section>
  );
}