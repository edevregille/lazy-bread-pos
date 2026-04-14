"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  transformUploadToCanonical,
  type UploadSource,
} from "@/lib/revenueUploadCsv";

type MonthlySummaryByType = {
  transactions: number;
  revenue: number;
  uniqueCustomers: number;
};

type MonthlySummaryMonth = {
  byType: Partial<
    Record<"bread-stand" | "market" | "online", MonthlySummaryByType>
  >;
  breadStandRetentionPct: number | null;
};

type MonthlySummaryApi = {
  version?: number;
  updatedAt?: string | null;
  months: Record<string, MonthlySummaryMonth>;
};

type RevenueTx = {
  date: string;
  from: string;
  amountTotal: number;
  type?: string;
  [key: string]: unknown;
};

type CustomerRow = {
  from: string;
  transactionCount: number;
  totalRevenue: number;
};

const THRESHOLD_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function normalizeTxType(t: RevenueTx): "bread-stand" | "market" | "online" | "in-person"
 {
  const v = String(t.type ?? "").trim().toLowerCase();
  if (v === "market" || v === "online" || v === "in-person") return v;
  return "bread-stand";
}

function formatTypeFilterLabel(type: string): string {
  if (type === "bread-stand") return "Bread stand";
  if (type === "market" || type === "in-person") return "Market";
  if (type === "online") return "Online";
  return type;
}

/** Consistent accent for type breakdown lines (matches filter semantics). */
function typeBreakdownTextClass(type: string): string {
  switch (type) {
    case "bread-stand":
      return "text-amber-800";
    case "market":
    case "in-person":
      return "text-emerald-800";
    case "online":
      return "text-violet-800";
    default:
      return "text-gray-700";
  }
}

type PerTypeStatsRow = {
  type: string;
  revenue: number;
  transactionCount: number;
  uniqueCustomerCount: number;
};

const TYPE_SORT_ORDER = ["bread-stand", "market", "online", "in-person"];

function compareTypeKeys(a: string, b: string): number {
  const ia = TYPE_SORT_ORDER.indexOf(a);
  const ib = TYPE_SORT_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

function aggregatePerTypeStats(transactions: RevenueTx[]): PerTypeStatsRow[] {
  const acc = new Map<
    string,
    { revenue: number; count: number; froms: Set<string> }
  >();
  for (const t of transactions) {
    const key = normalizeTxType(t);
    let row = acc.get(key);
    if (!row) {
      row = { revenue: 0, count: 0, froms: new Set<string>() };
      acc.set(key, row);
    }
    row.revenue += Number(t.amountTotal) || 0;
    row.count += 1;
    row.froms.add(String(t.from));
  }
  return [...acc.entries()]
    .sort(([a], [b]) => compareTypeKeys(a, b))
    .map(([type, v]) => ({
      type,
      revenue: v.revenue,
      transactionCount: v.count,
      uniqueCustomerCount: v.froms.size,
    }));
}

function formatCurrency(cents: number, currency: string = "usd"): string {
  const value = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value);
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function typeBarSegmentBg(type: string): string {
  switch (type) {
    case "bread-stand":
      return "bg-amber-400";
    case "market":
    case "in-person":
      return "bg-emerald-500";
    case "online":
      return "bg-violet-500";
    default:
      return "bg-gray-400";
  }
}

type RevenueChartRow = {
  period: string;
  revenueCents: number;
  byTypeCents?: Record<string, number>;
  breadStandRetentionPct: number | null;
};

function monthlySummaryToChartRows(summary: MonthlySummaryApi): RevenueChartRow[] {
  const monthKeys = Object.keys(summary.months ?? {}).sort();
  return monthKeys.map((period) => {
    const m = summary.months[period];
    const byTypeCents: Record<string, number> = {};
    let revenueCents = 0;
    for (const [t, v] of Object.entries(m.byType ?? {})) {
      if (!v) continue;
      const c = Math.round(Number(v.revenue) * 100);
      byTypeCents[t] = c;
      revenueCents += c;
    }
    return {
      period,
      revenueCents,
      byTypeCents,
      breadStandRetentionPct: m.breadStandRetentionPct ?? null,
    };
  });
}

function MonthBarTooltipPanel({ row }: { row: RevenueChartRow }) {
  const types = Object.entries(row.byTypeCents ?? {})
    .filter(([, c]) => c > 0)
    .sort(([a], [b]) => compareTypeKeys(a, b));
  return (
    <div className="pointer-events-none max-w-[15rem] space-y-2 text-left text-xs">
      <div className="font-semibold text-gray-900">{row.period}</div>
      <div className="space-y-1 border-t border-gray-100 pt-2 text-gray-800">
        <div className="tabular-nums">
          Total: {formatCurrency(row.revenueCents)}
        </div>
        {types.map(([ty, c]) => (
          <div key={ty} className="tabular-nums">
            {formatTypeFilterLabel(ty)}: {formatCurrency(c)}
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 pt-2 text-gray-600">
        Retention (bread-stand):{" "}
        {row.breadStandRetentionPct != null
          ? `${row.breadStandRetentionPct.toFixed(1)}%`
          : "—"}
      </div>
    </div>
  );
}

/** Straight line segments between consecutive months with retention (SVG viewBox 0..n × 0..100). */
function retentionStraightSegments(
  rows: RevenueChartRow[]
): { x1: number; y1: number; x2: number; y2: number }[] {
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  let prev: { i: number; ret: number } | null = null;
  rows.forEach((row, i) => {
    const r = row.breadStandRetentionPct;
    if (r == null) {
      prev = null;
      return;
    }
    if (prev != null) {
      segs.push({
        x1: prev.i + 0.5,
        y1: 100 - prev.ret,
        x2: i + 0.5,
        y2: 100 - r,
      });
    }
    prev = { i, ret: r };
  });
  return segs;
}

function formatRetentionPointLabel(pct: number): string {
  const rounded = Math.round(pct);
  return `${rounded}%`;
}

function RevenueStackedBarChart({
  rows,
  xLabel,
}: {
  rows: RevenueChartRow[];
  xLabel: string;
}) {
  const [hoverPeriod, setHoverPeriod] = useState<string | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHideTooltip = () => {
    if (leaveTimerRef.current != null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const showTooltip = (period: string) => {
    cancelHideTooltip();
    setHoverPeriod(period);
  };

  const hideTooltipSoon = () => {
    cancelHideTooltip();
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null;
      setHoverPeriod(null);
    }, 120);
  };

  useEffect(() => () => cancelHideTooltip(), []);

  if (rows.length === 0) return null;
  const n = rows.length;
  const maxBar = Math.max(...rows.map((r) => r.revenueCents), 1);
  const allTypes = new Set<string>();
  for (const r of rows) {
    if (r.byTypeCents) {
      for (const [k, v] of Object.entries(r.byTypeCents)) {
        if (v > 0) allTypes.add(k);
      }
    }
  }
  const legendTypes = [...allTypes].sort(compareTypeKeys);

  const gridTemplate = `repeat(${n}, minmax(2.75rem, 1fr))`;
  const lineSegments = retentionStraightSegments(rows);

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm text-gray-800">
        <span className="font-medium">Revenue by {xLabel}</span>
        
      </p>
      <div className="relative min-w-0">
        <div
          className="grid min-w-0 gap-0"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {rows.map((row) => {
            const rowTypes =
              row.revenueCents <= 0
                ? []
                : Object.entries(row.byTypeCents ?? {})
                    .filter(([, c]) => c > 0)
                    .sort(([a], [b]) => compareTypeKeys(a, b))
                    .map(([t]) => t);
            const barHeightPct = (row.revenueCents / maxBar) * 100;
            const ret = row.breadStandRetentionPct;
            const open = hoverPeriod === row.period;
            return (
              <div
                key={row.period}
                className="flex min-w-0 flex-col items-center gap-1 px-0.5"
                onMouseEnter={() => showTooltip(row.period)}
                onMouseLeave={hideTooltipSoon}
              >
                <div className="relative w-full">
                  {open && (
                    <div
                      className="absolute bottom-full left-1/2 z-50 mb-2 w-max min-w-[11rem] -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-lg ring-1 ring-black/5"
                      role="tooltip"
                    >
                      <MonthBarTooltipPanel row={row} />
                    </div>
                  )}
                  <div className="relative h-52 w-full">
                    <div className="absolute inset-0 flex flex-col justify-end">
                      <div
                        className="relative z-10 mx-auto flex w-[85%] max-w-[2.75rem] flex-col justify-end"
                        style={{ height: `${barHeightPct}%` }}
                      >
                        <div className="flex min-h-0 w-full flex-1 flex-col-reverse overflow-hidden rounded-t shadow-inner ring-1 ring-gray-200/80">
                          {rowTypes.length === 0 && row.revenueCents > 0 ? (
                            <div className="h-full w-full bg-gray-300" />
                          ) : (
                            rowTypes.map((ty) => {
                              const c = row.byTypeCents?.[ty] ?? 0;
                              const pct =
                                row.revenueCents > 0
                                  ? (c / row.revenueCents) * 100
                                  : 0;
                              return (
                                <div
                                  key={ty}
                                  className={`min-h-[2px] w-full shrink-0 ${typeBarSegmentBg(ty)}`}
                                  style={{ height: `${pct}%` }}
                                />
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="max-w-[4.5rem] text-center text-[10px] leading-tight text-gray-600 sm:text-xs">
                  {row.period}
                </span>
              </div>
            );
          })}
        </div>
        <svg
          className="pointer-events-none absolute left-0 right-0 top-0 z-[18] h-52 w-full text-rose-600"
          viewBox={`0 0 ${n} 100`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {lineSegments.map((seg, si) => (
            <line
              key={si}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke="currentColor"
              strokeWidth={0.35}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {rows.map((row, i) => {
            const ret = row.breadStandRetentionPct;
            if (ret == null) return null;
            return (
              <circle
                key={`dot-${row.period}`}
                cx={i + 0.5}
                cy={100 - ret}
                r={0.42}
                fill="currentColor"
                stroke="white"
                strokeWidth={0.12}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-[25] grid h-52"
          style={{ gridTemplateColumns: gridTemplate }}
          aria-hidden
        >
          {rows.map((row) => {
            const ret = row.breadStandRetentionPct;
            if (ret == null) {
              return <div key={`lab-${row.period}`} />;
            }
            return (
              <div
                key={`lab-${row.period}`}
                className="relative px-0.5"
              >
                <span
                  className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums text-rose-700 sm:text-[11px]"
                  style={{
                    top: `calc(${100 - ret}% - 16px)`,
                  }}
                >
                  {formatRetentionPointLabel(ret)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-600">
        {legendTypes.map((ty) => (
          <span key={ty} className="inline-flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-sm ${typeBarSegmentBg(ty)}`}
            />
            {formatTypeFilterLabel(ty)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-gray-700">
          <span className="inline-flex items-center gap-0.5">
            <span className="h-0.5 w-4 shrink-0 rounded-full bg-rose-600" />
            <span className="h-2 w-2 shrink-0 rounded-full bg-rose-600 ring-2 ring-white shadow" />
          </span>
          Retention (bread-stand)
        </span>
      </div>
    </div>
  );
}

function defaultFromUntil(): { from: string; until: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const until = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  return { from, until };
}

function countByCustomer(transactions: RevenueTx[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of transactions) {
    const k = String(t.from);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function customersWithMoreThanN(transactions: RevenueTx[], n: number): number {
  const counts = countByCustomer(transactions);
  let c = 0;
  for (const v of counts.values()) {
    if (v > n) c++;
  }
  return c;
}

function aggregateCustomersByFrom(transactions: RevenueTx[]): CustomerRow[] {
  const m = new Map<string, { count: number; total: number }>();
  for (const t of transactions) {
    const key = String(t.from);
    const prev = m.get(key) ?? { count: 0, total: 0 };
    prev.count += 1;
    prev.total += Number(t.amountTotal) || 0;
    m.set(key, prev);
  }
  return Array.from(m.entries())
    .map(([from, v]) => ({
      from,
      transactionCount: v.count,
      totalRevenue: v.total,
    }))
    .sort(
      (a, b) =>
        b.totalRevenue - a.totalRevenue || a.from.localeCompare(b.from)
    );
}

export default function RevenueView() {
  const defaults = useMemo(() => defaultFromUntil(), []);
  const [txFrom, setTxFrom] = useState(defaults.from);
  const [txUntil, setTxUntil] = useState(defaults.until);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<RevenueTx[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSource, setUploadSource] = useState<UploadSource>("venmo");
  const [customerFilter, setCustomerFilter] = useState<"all" | number>("all");
  const [txTypeFilter, setTxTypeFilter] = useState<string>("all");
  const [txLoadedOnce, setTxLoadedOnce] = useState(false);
  const [revenueTab, setRevenueTab] = useState<
    "summary" | "detail" | "manage"
  >("summary");
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryApi | null>(
    null
  );
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [deleteFrom, setDeleteFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-01-01`;
  });
  const [deleteUntil, setDeleteUntil] = useState(() => toIsoDate(new Date()));
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadMonthlySummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const res = await fetch("/api/revenue-transactions/monthly-summary");
      const body = (await res.json().catch(() => ({}))) as MonthlySummaryApi & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Failed to load monthly summary"
        );
      }
      setMonthlySummary({
        version: body.version,
        updatedAt: body.updatedAt ?? null,
        months: body.months ?? {},
      });
    } catch (e) {
      setSummaryError(
        e instanceof Error ? e.message : "Unable to load monthly summary"
      );
      setMonthlySummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (revenueTab === "summary") void loadMonthlySummary();
  }, [revenueTab, loadMonthlySummary]);

  const distinctTypesInRange = useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) {
      set.add(normalizeTxType(t));
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  useEffect(() => {
    if (txTypeFilter === "all") return;
    if (!distinctTypesInRange.includes(txTypeFilter)) {
      setTxTypeFilter("all");
    }
  }, [distinctTypesInRange, txTypeFilter]);

  const transactionsForDetail = useMemo(() => {
    if (txTypeFilter === "all") return transactions;
    return transactions.filter((t) => normalizeTxType(t) === txTypeFilter);
  }, [transactions, txTypeFilter]);

  const customerCounts = useMemo(
    () => countByCustomer(transactionsForDetail),
    [transactionsForDetail]
  );

  const customerRows = useMemo(
    () => aggregateCustomersByFrom(transactionsForDetail),
    [transactionsForDetail]
  );

  const displayedCustomerRows = useMemo(() => {
    if (customerFilter === "all") return customerRows;
    const n = customerFilter;
    return customerRows.filter((r) => r.transactionCount > n);
  }, [customerRows, customerFilter]);

  const txTotalRevenue = useMemo(
    () =>
      transactionsForDetail.reduce((s, t) => s + (Number(t.amountTotal) || 0), 0),
    [transactionsForDetail]
  );

  const perTypeStats = useMemo(
    () => aggregatePerTypeStats(transactionsForDetail),
    [transactionsForDetail]
  );

  const loadTransactions = async () => {
    if (!txFrom) {
      setTxError("Choose a start date");
      return;
    }
    const params = new URLSearchParams({ from: txFrom });
    if (txUntil) params.set("until", txUntil);
    try {
      setTxLoading(true);
      setTxError(null);
      setCustomerFilter("all");
      setTxTypeFilter("all");
      const res = await fetch(`/api/revenue-transactions?${params.toString()}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to load transactions");
      }
      const list = (body.transactions ?? []) as RevenueTx[];
      setTransactions(Array.isArray(list) ? list : []);
      setTxLoadedOnce(true);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Unable to load transactions");
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  };

  const onUploadFile = async (file: File | null) => {
    setUploadMessage(null);
    setUploadError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Please choose a CSV file.");
      return;
    }
    const text = await file.text();
    const canonical = transformUploadToCanonical(uploadSource, text);
    if ("error" in canonical) {
      setUploadError(canonical.error);
      return;
    }
    try {
      setUploadBusy(true);
      const res = await fetch("/api/revenue-transactions/upload", {
        method: "POST",
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
        },
        body: canonical.csv,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? body.message ?? "Upload failed");
      }
      const parts: string[] = [];
      if (typeof body.rowsImported === "number") {
        parts.push(`${body.rowsImported} row(s) imported`);
      }
      if (typeof body.daysWritten === "number") {
        parts.push(`${body.daysWritten} day file(s) updated`);
      }
      setUploadMessage(parts.length ? parts.join(" · ") : "Upload complete.");
      if (Array.isArray(body.rowErrors) && body.rowErrors.length) {
        setUploadMessage(
          (parts.length ? parts.join(" · ") + ". " : "") +
            `${body.rowErrors.length} row(s) skipped (see server logs for details).`
        );
      }
      void loadMonthlySummary();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  };

  const onDeleteRange = async () => {
    setDeleteMessage(null);
    setDeleteError(null);
    if (!deleteFrom || !deleteUntil) {
      setDeleteError("Choose both start and end dates.");
      return;
    }
    if (
      !window.confirm(
        `Remove all stored transactions from ${deleteFrom} through ${deleteUntil}? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      setDeleteBusy(true);
      const res = await fetch("/api/revenue-transactions/delete-range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: deleteFrom, until: deleteUntil }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (body.error as string) ??
            (body.message as string) ??
            "Delete failed"
        );
      }
      const n =
        typeof body.daysDeleted === "number" ? body.daysDeleted : 0;
      setDeleteMessage(
        `Removed data for ${n} calendar day(s). The monthly summary was rebuilt.`
      );
      void loadMonthlySummary();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
          Revenue
        </h2>

        <div
          className="flex rounded-xl border border-gray-200 overflow-hidden mb-6 w-full sm:w-fit"
          role="tablist"
          aria-label="Revenue sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={revenueTab === "summary"}
            onClick={() => setRevenueTab("summary")}
            className={`px-4 py-2.5 text-sm font-medium sm:min-w-[10rem] ${
              revenueTab === "summary"
                ? "bg-blue-600 text-white"
                : "bg-gray-50 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Monthly Summary
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={revenueTab === "detail"}
            onClick={() => setRevenueTab("detail")}
            className={`px-4 py-2.5 text-sm font-medium sm:min-w-[10rem] border-l border-gray-200 ${
              revenueTab === "detail"
                ? "bg-blue-600 text-white"
                : "bg-gray-50 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Transaction detail
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={revenueTab === "manage"}
            onClick={() => setRevenueTab("manage")}
            className={`px-4 py-2.5 text-sm font-medium sm:min-w-[10rem] border-l border-gray-200 ${
              revenueTab === "manage"
                ? "bg-blue-600 text-white"
                : "bg-gray-50 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Manage Revenue Data
          </button>
        </div>

        {revenueTab === "summary" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Per-month metrics from stored transactions: revenue and counts by type (bread-stand,
              market, online), bread-stand unique customers, and bread-stand retention vs. the
              prior month.
            </p>
            {summaryLoading && (
              <p className="text-gray-500">Loading monthly summary…</p>
            )}
            {summaryError && (
              <p className="text-red-600 font-medium">{summaryError}</p>
            )}
            {!summaryLoading && !summaryError && monthlySummary && (
              <>
             
                {monthlySummaryToChartRows(monthlySummary).length > 0 ? (
                  <RevenueStackedBarChart
                    rows={monthlySummaryToChartRows(monthlySummary)}
                    xLabel="month"
                  />
                ) : (
                  <p className="text-sm text-gray-500">No monthly data yet.</p>
                )}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Month
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Bread stand
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Market
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Online
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">
                          Retention (bread-stand)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {Object.keys(monthlySummary.months).length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-4 text-gray-500 text-sm"
                          >
                            No rows in this summary.
                          </td>
                        </tr>
                      ) : (
                        Object.keys(monthlySummary.months)
                          .sort()
                          .map((period) => {
                            const row = monthlySummary.months[period];
                            const cell = (t: "bread-stand" | "market" | "online") => {
                              const b = row.byType?.[t];
                              if (!b) return <span className="text-gray-400">—</span>;
                              return (
                                <div>
                                  <div className="font-medium tabular-nums">
                                    {formatMoney(b.revenue)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {b.transactions} tx · {b.uniqueCustomers} cust
                                  </div>
                                </div>
                              );
                            };
                            return (
                              <tr key={period} className="hover:bg-gray-50/50">
                                <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                                  {period}
                                </td>
                                <td className="px-3 py-2 align-top text-gray-900">
                                  {cell("bread-stand")}
                                </td>
                                <td className="px-3 py-2 align-top text-gray-900">
                                  {cell("market")}
                                </td>
                                <td className="px-3 py-2 align-top text-gray-900">
                                  {cell("online")}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-900 tabular-nums align-top">
                                  {row.breadStandRetentionPct == null
                                    ? "—"
                                    : `${row.breadStandRetentionPct.toFixed(1)}%`}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {revenueTab === "manage" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Remove transactions in range
              </h3>
              <p className="text-sm text-gray-600">
                Deletes stored per-day files for each calendar day from{" "}
                <span className="font-medium">From</span> through{" "}
                <span className="font-medium">Until</span> (inclusive), then rebuilds the
                monthly summary from what remains.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label
                    htmlFor="revenue-del-from"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    From
                  </label>
                  <input
                    id="revenue-del-from"
                    type="date"
                    value={deleteFrom}
                    onChange={(e) => setDeleteFrom(e.target.value)}
                    disabled={deleteBusy}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label
                    htmlFor="revenue-del-until"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Until
                  </label>
                  <input
                    id="revenue-del-until"
                    type="date"
                    value={deleteUntil}
                    onChange={(e) => setDeleteUntil(e.target.value)}
                    disabled={deleteBusy}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void onDeleteRange()}
                  disabled={deleteBusy}
                  className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-800 disabled:opacity-50"
                >
                  {deleteBusy ? "Removing…" : "Remove transactions in range"}
                </button>
              </div>
              {deleteError && (
                <p className="text-sm text-red-600">{deleteError}</p>
              )}
              {deleteMessage && !deleteError && (
                <p className="text-sm text-green-700">{deleteMessage}</p>
              )}
            </div>

            <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Choose where this export came from. The app converts it to the upload
              format (Date, From, Amount (total), Type) before sending.
            </p>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 max-w-2xl">
              <li>
                <span className="font-medium">Venmo</span>: columns{" "}
                <code className="text-xs bg-gray-100 px-1 rounded">Date</code> (MM/DD/YYYY),{" "}
                <code className="text-xs bg-gray-100 px-1 rounded">From</code>,{" "}
                <code className="text-xs bg-gray-100 px-1 rounded">Amount (total)</code>.
                If the export includes a{" "}
                <code className="text-xs bg-gray-100 px-1 rounded">Type</code> column, only rows
                with Type = Payment are imported. Each imported row is stored with{" "}
                <code className="text-xs bg-gray-100 px-1 rounded">Type</code> = bread-stand.
              </li>
              <li>
                <span className="font-medium">Stripe</span>: columns{" "}
                <code className="text-xs bg-gray-100 px-1 rounded">created_utc</code> (UTC
                datetime), <code className="text-xs bg-gray-100 px-1 rounded">gross</code>,{" "}
                <code className="text-xs bg-gray-100 px-1 rounded">customer_name</code>{" "}
                (optional; empty uses &quot;Unknown&quot;),{" "}
                <code className="text-xs bg-gray-100 px-1 rounded">
                  payment_metadata[orderType]
                </code>{" "}
                for Type (in-person / empty → bread-stand; market / online as-is).
              </li>
            </ul>
            <div className="max-w-lg">
              <label
                htmlFor="revenue-upload-source"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Report source
              </label>
              <select
                id="revenue-upload-source"
                value={uploadSource}
                onChange={(e) => setUploadSource(e.target.value as UploadSource)}
                disabled={uploadBusy}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="venmo">Venmo</option>
                <option value="stripe">Stripe</option>
              </select>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Choose file
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={uploadBusy}
              className="block w-full max-w-lg text-sm text-gray-700 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-gray-50 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-100"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                void onUploadFile(f);
                e.target.value = "";
              }}
            />
            {uploadBusy && (
              <p className="mt-2 text-sm text-gray-500">Uploading…</p>
            )}
            {uploadError && (
              <p className="mt-2 text-sm text-red-600">{uploadError}</p>
            )}
            {uploadMessage && !uploadError && (
              <p className="mt-2 text-sm text-green-700">{uploadMessage}</p>
            )}
            </div>
          </div>
        )}

        {revenueTab === "detail" && (
        <div className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Transaction detail
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Load uploaded CSV data for a date range. Use{" "}
          <span className="font-medium">Type</span> under the date fields to narrow
          loaded transactions.
        </p>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <label htmlFor="tx-from" className="block text-xs font-medium text-gray-600 mb-1">
              From
            </label>
            <input
              id="tx-from"
              type="date"
              value={txFrom}
              onChange={(e) => setTxFrom(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="tx-until" className="block text-xs font-medium text-gray-600 mb-1">
              Until (optional)
            </label>
            <input
              id="tx-until"
              type="date"
              value={txUntil}
              onChange={(e) => setTxUntil(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadTransactions()}
            disabled={txLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50"
          >
            {txLoading ? "Loading…" : "Load data"}
          </button>
        </div>
        <div className="max-w-lg mb-4">
          <label
            htmlFor="tx-type-filter"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Type
          </label>
          <select
            id="tx-type-filter"
            value={txTypeFilter}
            onChange={(e) => setTxTypeFilter(e.target.value)}
            disabled={txLoading}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 sm:max-w-xs"
          >
            <option value="all">All types</option>
            {distinctTypesInRange.map((t) => (
              <option key={t} value={t}>
                {formatTypeFilterLabel(t)}
              </option>
            ))}
          </select>
        </div>

        {txError && (
          <p className="text-red-600 text-sm font-medium mb-4">{txError}</p>
        )}

        {transactions.length > 0 && (
          <div className="space-y-4 mb-6">
            {transactionsForDetail.length === 0 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No transactions match the selected type for this date range. Choose
                &quot;All types&quot; or pick another type.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-200 border-l-4 border-l-blue-500 bg-blue-50/50 px-3 py-2.5 shadow-sm">
                <div className="text-xs font-medium text-blue-900/80">Total revenue</div>
                <div className="text-lg font-semibold text-gray-900 tabular-nums">
                  {formatMoney(txTotalRevenue)}
                </div>
                {perTypeStats.length > 0 && (
                  <ul className="mt-2 space-y-0.5 border-t border-blue-200/80 pt-2 text-xs">
                    {perTypeStats.map((row) => (
                      <li
                        key={row.type}
                        className={`flex justify-between gap-2 tabular-nums ${typeBreakdownTextClass(row.type)}`}
                      >
                        <span>{formatTypeFilterLabel(row.type)}</span>
                        <span>{formatMoney(row.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 border-l-4 border-l-emerald-500 bg-emerald-50/50 px-3 py-2.5 shadow-sm">
                <div className="text-xs font-medium text-emerald-900/80">Transactions</div>
                <div className="text-lg font-semibold text-gray-900 tabular-nums">
                  {transactionsForDetail.length}
                </div>
                {perTypeStats.length > 0 && (
                  <ul className="mt-2 space-y-0.5 border-t border-emerald-200/80 pt-2 text-xs">
                    {perTypeStats.map((row) => (
                      <li
                        key={row.type}
                        className={`flex justify-between gap-2 tabular-nums ${typeBreakdownTextClass(row.type)}`}
                      >
                        <span>{formatTypeFilterLabel(row.type)}</span>
                        <span>{row.transactionCount}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 border-l-4 border-l-violet-500 bg-violet-50/50 px-3 py-2.5 shadow-sm">
                <div className="text-xs font-medium text-violet-900/80">Unique customers</div>
                <div className="text-lg font-semibold text-gray-900 tabular-nums">
                  {customerCounts.size}
                </div>
                {perTypeStats.length > 0 && (
                  <ul className="mt-2 space-y-0.5 border-t border-violet-200/80 pt-2 text-xs">
                    {perTypeStats.map((row) => (
                      <li
                        key={row.type}
                        className={`flex justify-between gap-2 tabular-nums ${typeBreakdownTextClass(row.type)}`}
                      >
                        <span>{formatTypeFilterLabel(row.type)}</span>
                        <span>{row.uniqueCustomerCount}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-600 mb-2">
                Customers by transaction count (click to filter list)
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCustomerFilter("all")}
                  className={`rounded-full px-3 py-1 text-sm border ${
                    customerFilter === "all"
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  All customers
                </button>
                {THRESHOLD_LEVELS.map((n) => {
                  const cnt = customersWithMoreThanN(transactionsForDetail, n);
                  const active = customerFilter === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCustomerFilter(n)}
                      className={`rounded-full px-3 py-1 text-sm border ${
                        active
                          ? "border-blue-600 bg-blue-50 text-blue-900"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      &gt; {n} tx: {cnt} customers
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {transactions.length > 0 && transactionsForDetail.length > 0 && (
          <div className="overflow-x-auto">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Customers</h4>
            <p className="text-xs text-gray-500 mb-2">
              Showing {displayedCustomerRows.length} of {customerRows.length} customer(s)
              {txTypeFilter !== "all"
                ? ` (${formatTypeFilterLabel(txTypeFilter)} only)`
                : ""}
              {customerFilter !== "all"
                ? ` (with &gt; ${customerFilter} transaction(s) in range)`
                : ""}
            </p>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Customer</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Transactions</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Total revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedCustomerRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-gray-500">
                      No customers match this filter.
                    </td>
                  </tr>
                ) : (
                  displayedCustomerRows.map((row) => (
                    <tr key={row.from} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-gray-900">{row.from}</td>
                      <td className="px-3 py-2 text-right text-gray-900 tabular-nums">
                        {row.transactionCount}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 tabular-nums">
                        {formatMoney(row.totalRevenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!txLoading && transactions.length === 0 && !txError && (
          <p className="text-sm text-gray-500">
            {txLoadedOnce
              ? "No transactions in this date range."
              : "Load a date range to see uploaded transactions."}
          </p>
        )}
        </div>
        )}
      </div>
    </div>
  );
}
