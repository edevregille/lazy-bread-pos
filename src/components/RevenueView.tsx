"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  transformUploadToCanonical,
  type UploadSource,
} from "@/lib/revenueUploadCsv";

type MonthEntry = {
  period: string;
  revenueCents: number;
  currency: string;
  /** Revenue in cents per normalized transaction type */
  byTypeCents?: Record<string, number>;
};

type YearEntry = {
  period: string;
  revenueCents: number;
  byTypeCents?: Record<string, number>;
};

type RevenueResponse = {
  byMonth: MonthEntry[];
  byYear: YearEntry[];
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

const PRESETS = [
  { id: "last12", label: "Last 12 months" },
  { id: "thisYear", label: "This year" },
  { id: "all", label: "All time" },
] as const;

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

/** Inclusive date range for GET /revenue-transactions (YYYY-MM-DD). */
function presetToDateRange(preset: string): { from: string; until: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const until = toIsoDate(now);

  if (preset === "all") {
    // Bounded default: avoid unbounded day iteration in the query Lambda.
    return { from: "2018-01-01", until };
  }
  if (preset === "thisYear") {
    return { from: `${year}-01-01`, until };
  }
  if (preset === "last12") {
    const from = new Date(year, month - 11, 1);
    return { from: toIsoDate(from), until };
  }
  if (/^\d{4}$/.test(preset)) {
    const y = parseInt(preset, 10);
    return { from: `${y}-01-01`, until: `${y}-12-31` };
  }
  return { from: `${year}-01-01`, until };
}

/** CSV Date column MM/DD/YYYY → calendar month key YYYY-MM. */
function parseTxMonthPeriod(dateStr: string): string | null {
  const m = String(dateStr).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = parseInt(m[1], 10);
  const yyyy = parseInt(m[3], 10);
  if (mm < 1 || mm > 12) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}`;
}

function aggregateTransactionsToRevenue(transactions: RevenueTx[]): RevenueResponse {
  const byMonthMap = new Map<string, { totalCents: number; byType: Map<string, number> }>();
  for (const t of transactions) {
    const period = parseTxMonthPeriod(String(t.date));
    if (!period) continue;
    const amt = Number(t.amountTotal) || 0;
    const cents = Math.round(amt * 100);
    const ty = normalizeTxType(t);
    let row = byMonthMap.get(period);
    if (!row) {
      row = { totalCents: 0, byType: new Map() };
      byMonthMap.set(period, row);
    }
    row.totalCents += cents;
    row.byType.set(ty, (row.byType.get(ty) ?? 0) + cents);
  }
  const byMonth: MonthEntry[] = Array.from(byMonthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({
      period,
      revenueCents: v.totalCents,
      currency: "usd",
      byTypeCents: Object.fromEntries(v.byType) as Record<string, number>,
    }));

  const byYearMap = new Map<string, { totalCents: number; byType: Map<string, number> }>();
  for (const m of byMonth) {
    const y = m.period.slice(0, 4);
    let row = byYearMap.get(y);
    if (!row) {
      row = { totalCents: 0, byType: new Map() };
      byYearMap.set(y, row);
    }
    row.totalCents += m.revenueCents;
    if (m.byTypeCents) {
      for (const [k, cents] of Object.entries(m.byTypeCents)) {
        row.byType.set(k, (row.byType.get(k) ?? 0) + cents);
      }
    }
  }
  const byYear: YearEntry[] = Array.from(byYearMap.entries())
    .map(([period, v]) => ({
      period,
      revenueCents: v.totalCents,
      byTypeCents: Object.fromEntries(v.byType) as Record<string, number>,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return { byMonth, byYear };
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
};

function RevenueStackedBarChart({
  rows,
  xLabel,
}: {
  rows: RevenueChartRow[];
  xLabel: string;
}) {
  if (rows.length === 0) return null;
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

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-gray-800">
        Revenue by {xLabel} (stacked by type)
      </p>
      <div className="flex min-h-[13rem] flex-wrap items-end justify-start gap-2 overflow-x-auto pb-2 pt-1">
        {rows.map((row) => {
          const rowTypes =
            row.revenueCents <= 0
              ? []
              : Object.entries(row.byTypeCents ?? {})
                  .filter(([, c]) => c > 0)
                  .sort(([a], [b]) => compareTypeKeys(a, b))
                  .map(([t]) => t);
          const barHeightPct = (row.revenueCents / maxBar) * 100;
          return (
            <div
              key={row.period}
              className="flex min-w-[2.75rem] flex-col items-center gap-1"
            >
              <div className="flex h-52 w-10 flex-col justify-end sm:w-11">
                <div
                  className="flex w-full min-h-0 flex-col-reverse overflow-hidden rounded-t shadow-inner ring-1 ring-gray-200/80"
                  style={{ height: `${barHeightPct}%` }}
                  title={formatCurrency(row.revenueCents)}
                >
                  {rowTypes.length === 0 && row.revenueCents > 0 ? (
                    <div
                      className="h-full w-full bg-gray-300"
                      title={formatCurrency(row.revenueCents)}
                    />
                  ) : (
                    rowTypes.map((ty) => {
                      const c = row.byTypeCents?.[ty] ?? 0;
                      const pct =
                        row.revenueCents > 0 ? (c / row.revenueCents) * 100 : 0;
                      return (
                        <div
                          key={ty}
                          className={`min-h-[2px] w-full shrink-0 ${typeBarSegmentBg(ty)}`}
                          style={{ height: `${pct}%` }}
                          title={`${formatTypeFilterLabel(ty)}: ${formatCurrency(c)}`}
                        />
                      );
                    })
                  )}
                </div>
              </div>
              <span
                className="max-w-[4.5rem] text-center text-[10px] leading-tight text-gray-600 sm:text-xs"
                title={row.period}
              >
                {row.period}
              </span>
            </div>
          );
        })}
      </div>
      {legendTypes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-600">
          {legendTypes.map((ty) => (
            <span key={ty} className="inline-flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-sm ${typeBarSegmentBg(ty)}`}
              />
              {formatTypeFilterLabel(ty)}
            </span>
          ))}
        </div>
      )}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RevenueResponse | null>(null);
  const [preset, setPreset] = useState<string>("thisYear");
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [yearOptions, setYearOptions] = useState<string[]>([]);

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
  const [revenueTab, setRevenueTab] = useState<"reports" | "detail" | "upload">(
    "reports"
  );

  const fetchRevenue = useCallback(async (presetValue: string) => {
    try {
      setLoading(true);
      setError(null);
      const { from, until } = presetToDateRange(presetValue);
      const params = new URLSearchParams({ from, until });
      const res = await fetch(`/api/revenue-transactions?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to load revenue data");
      }
      const body = await res.json().catch(() => ({}));
      const list = (body.transactions ?? []) as RevenueTx[];
      const json = aggregateTransactionsToRevenue(Array.isArray(list) ? list : []);
      setData(json);

      const years = [...new Set(json.byMonth.map((m) => m.period.slice(0, 4)))].sort(
        (a, b) => b.localeCompare(a)
      );
      setYearOptions(years);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load revenue data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRevenue(preset);
  }, [preset, fetchRevenue]);

  const handlePresetChange = (value: string) => {
    setPreset(value);
  };

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
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
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
            aria-selected={revenueTab === "reports"}
            onClick={() => setRevenueTab("reports")}
            className={`px-4 py-2.5 text-sm font-medium sm:min-w-[10rem] ${
              revenueTab === "reports"
                ? "bg-blue-600 text-white"
                : "bg-gray-50 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Revenue Reports
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
            aria-selected={revenueTab === "upload"}
            onClick={() => setRevenueTab("upload")}
            className={`px-4 py-2.5 text-sm font-medium sm:min-w-[10rem] border-l border-gray-200 ${
              revenueTab === "upload"
                ? "bg-blue-600 text-white"
                : "bg-gray-50 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Upload revenue data
          </button>
        </div>

        {revenueTab === "upload" && (
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
                Each row gets <code className="text-xs bg-gray-100 px-1 rounded">Type</code>{" "}
                = bread-stand.
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
        )}

        {revenueTab === "reports" && (
          <>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label htmlFor="revenue-preset" className="text-sm font-medium text-gray-700">
            Period
          </label>
          <select
            id="revenue-preset"
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === "month"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              By month
            </button>
            <button
              type="button"
              onClick={() => setViewMode("year")}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === "year"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              By year
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-gray-500">Loading revenue data…</p>
        )}

        {error && (
          <p className="text-red-600 font-medium">{error}</p>
        )}

        {!loading && !error && data && viewMode === "month" && (
          <>
          <RevenueStackedBarChart rows={data.byMonth} xLabel="month" />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                    Month
                  </th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.byMonth.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-gray-500 text-sm">
                      No revenue data for this period.
                    </td>
                  </tr>
                ) : (
                  data.byMonth.map((row) => (
                    <tr key={row.period} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-sm text-gray-900">{row.period}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                        {formatCurrency(row.revenueCents, row.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </>
        )}

        {!loading && !error && data && viewMode === "year" && (
          <>
          <RevenueStackedBarChart rows={data.byYear} xLabel="year" />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                    Year
                  </th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.byYear.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-gray-500 text-sm">
                      No revenue data for this period.
                    </td>
                  </tr>
                ) : (
                  data.byYear.map((row) => (
                    <tr key={row.period} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-sm text-gray-900">{row.period}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                        {formatCurrency(row.revenueCents, "usd")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </>
        )}

        </>
        )}

        {revenueTab === "detail" && (
        <div className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Transaction detail
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Load uploaded CSV data for a date range. Use{" "}
          <span className="font-medium">Type</span> under the date fields to narrow
          loaded transactions. Same underlying data as Revenue Reports (aggregated by month or year there).
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
