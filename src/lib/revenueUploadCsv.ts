/**
 * Client-side CSV parse/serialize and transforms for revenue uploads (Venmo / Stripe → canonical upload format).
 */

export type UploadSource = "venmo" | "stripe";

export type RevenueType = "bread-stand" | "market" | "online";

function serializeCsv(headers: string[], dataRows: string[][]): string {
  const esc = (s: string) => {
    const t = String(s);
    if (/[",\r\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
    return t;
  };
  const line = (cells: string[]) => cells.map(esc).join(",");
  return [line(headers), ...dataRows.map(line)].join("\n");
}

/** RFC4180-style parse: handles quoted fields and commas inside quotes. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const normalized = text.replace(/^\uFEFF/, "");
  const allRows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const flushField = () => {
    row.push(field);
    field = "";
  };

  while (i < normalized.length) {
    const c = normalized[i];
    if (inQuotes) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      flushField();
      i++;
      continue;
    }
    if (c === "\n" || (c === "\r" && normalized[i + 1] === "\n")) {
      if (c === "\r") i++;
      flushField();
      allRows.push(row);
      row = [];
      i++;
      continue;
    }
    if (c === "\r") {
      flushField();
      allRows.push(row);
      row = [];
      i++;
      continue;
    }
    field += c;
    i++;
  }
  flushField();
  allRows.push(row);

  if (allRows.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = allRows[0].map((h) => String(h).trim());
  const rows = allRows
    .slice(1)
    .filter((r) => r.some((cell) => String(cell).trim() !== ""));
  return { headers, rows };
}

/** Stripe `created_utc` e.g. "2026-01-10 19:09:18" → MM/DD/YYYY */
export function createdUtcToMmddyyyy(s: string): string | null {
  const t = String(s).trim();
  if (!t) return null;
  const datePart = t.split(/\s+/)[0];
  const m = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const y = m[1];
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${String(mo).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
}

/**
 * Maps Stripe `payment_metadata[orderType]` to stored revenue type.
 * `null`, empty, or CSV literal "null" → in-person (stored as bread-stand).
 */
export function mapStripeOrderTypeToRevenueType(
  raw: string | undefined | null
): RevenueType {
  if (raw === null || raw === undefined) {
    return "market";
  }
  const s = String(raw).trim().toLowerCase();
  if (!s || s === "null" || s === "undefined") {
    return "market";
  }
  if (s === "market") return "market";
  if (s === "online") return "online";
  if (s === "in-person" || s === "in person" || s === "inperson") {
    return "market";
  }
  return "market";
}

export function transformVenmoToCanonical(
  csvText: string
): { csv: string } | { error: string } {
  const { headers, rows } = parseCsv(csvText);
  const required = ["Date", "From", "Amount (total)"] as const;
  for (const h of required) {
    if (!headers.includes(h)) {
      return {
        error: `Venmo CSV must include columns: ${required.join(", ")}. Found: ${headers.join(", ")}`,
      };
    }
  }
  if (rows.length === 0) {
    return { error: "No data rows in CSV." };
  }
  const idx = {
    date: headers.indexOf("Date"),
    from: headers.indexOf("From"),
    amount: headers.indexOf("Amount (total)"),
  };
  const outHeaders = ["Date", "From", "Amount (total)", "Type"];
  const outRows: string[][] = [];
  for (const r of rows) {
    const date = String(r[idx.date] ?? "").trim();
    const from = String(r[idx.from] ?? "").trim();
    const amount = String(r[idx.amount] ?? "").trim();
    outRows.push([date, from, amount, "bread-stand"]);
  }
  return { csv: serializeCsv(outHeaders, outRows) };
}

const STRIPE_REQUIRED = ["created_utc", "gross"] as const;
const ORDER_TYPE_HEADER = "payment_metadata[orderType]";

export function transformStripeToCanonical(
  csvText: string
): { csv: string } | { error: string } {
  const { headers, rows } = parseCsv(csvText);
  for (const h of STRIPE_REQUIRED) {
    if (!headers.includes(h)) {
      return {
        error: `Stripe CSV must include columns: ${STRIPE_REQUIRED.join(", ")}, and optionally customer_name and ${ORDER_TYPE_HEADER}. Found: ${headers.join(", ")}`,
      };
    }
  }
  if (rows.length === 0) {
    return { error: "No data rows in CSV." };
  }
  const idxCreated = headers.indexOf("created_utc");
  const idxGross = headers.indexOf("gross");
  const idxName = headers.indexOf("customer_name");
  const idxOrderType = headers.indexOf(ORDER_TYPE_HEADER);
  const outHeaders = ["Date", "From", "Amount (total)", "Type"];
  const outRows: string[][] = [];
  for (let ri = 0; ri < rows.length; ri++) {
    const r = rows[ri];
    const created = String(r[idxCreated] ?? "").trim();
    const date = createdUtcToMmddyyyy(created);
    if (!date) {
      return {
        error: `Row ${ri + 2}: invalid created_utc "${created}" (expected e.g. 2026-01-10 19:09:18).`,
      };
    }
    const gross = String(r[idxGross] ?? "").trim();
    const nameRaw = idxName >= 0 ? String(r[idxName] ?? "").trim() : "";
    const from = nameRaw || "Unknown";
    let orderTypeRaw: string | null | undefined;
    if (idxOrderType < 0) {
      orderTypeRaw = null;
    } else {
      const cell = r[idxOrderType];
      orderTypeRaw =
        cell === undefined || cell === null || String(cell).trim() === ""
          ? null
          : String(cell);
    }
    const type = mapStripeOrderTypeToRevenueType(orderTypeRaw);
    outRows.push([date, from, gross, type]);
  }
  return { csv: serializeCsv(outHeaders, outRows) };
}

export function transformUploadToCanonical(
  source: UploadSource,
  csvText: string
): { csv: string } | { error: string } {
  if (source === "venmo") return transformVenmoToCanonical(csvText);
  return transformStripeToCanonical(csvText);
}
