"use client";

import { useState, useEffect, useCallback } from "react";

type MonthEntry = {
  period: string;
  revenueCents: number;
  currency: string;
  feeCents?: number;
};

type YearEntry = {
  period: string;
  revenueCents: number;
};

type RevenueResponse = {
  byMonth: MonthEntry[];
  byYear: YearEntry[];
};

const PRESETS = [
  { id: "last12", label: "Last 12 months" },
  { id: "thisYear", label: "This year" },
  { id: "all", label: "All time" },
] as const;

function formatCurrency(cents: number, currency: string = "usd"): string {
  const value = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value);
}

function getQueryForPreset(preset: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === "all") {
    return "";
  }
  if (preset === "thisYear") {
    return `year=${year}`;
  }
  if (preset === "last12") {
    const from = new Date(year, month - 11, 1);
    const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
    const toStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    return `from=${fromStr}&to=${toStr}`;
  }
  return `year=${preset}`;
}

export default function RevenueView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RevenueResponse | null>(null);
  const [preset, setPreset] = useState<string>("thisYear");
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [yearOptions, setYearOptions] = useState<string[]>([]);

  const fetchRevenue = useCallback(async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/revenue?${query}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to load revenue data");
      }
      const json: RevenueResponse = await res.json();
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
    const query = getQueryForPreset(preset);
    fetchRevenue(query);
  }, [preset, fetchRevenue]);

  const handlePresetChange = (value: string) => {
    setPreset(value);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
          Revenue
        </h2>

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
        )}

        {!loading && !error && data && viewMode === "year" && (
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
        )}
      </div>
    </div>
  );
}
