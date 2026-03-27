import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const bucket = process.env.REVENUE_BUCKET;
const region = process.env.AWS_REGION ?? "us-east-1";

export async function GET(req: NextRequest) {
  if (!bucket) {
    return NextResponse.json(
      { error: "REVENUE_BUCKET is not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from"); // YYYY-MM
  const to = searchParams.get("to"); // YYYY-MM
  const yearParam = searchParams.get("year"); // YYYY

  const s3 = new S3Client({ region });

  try {
    const prefix = "revenue/";
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const list = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      const contents = list.Contents ?? [];
      for (const obj of contents) {
        if (obj.Key?.endsWith(".json")) keys.push(obj.Key);
      }
      continuationToken = list.NextContinuationToken;
    } while (continuationToken);

    // Parse keys: revenue/YYYY/YYYY-MM.json
    const monthKeys = keys.filter((k) => /^revenue\/\d{4}\/\d{4}-\d{2}\.json$/.test(k));
    const byMonth: { period: string; revenueCents: number; currency: string; feeCents?: number }[] = [];

    for (const key of monthKeys) {
      const match = key.match(/^revenue\/(\d{4})\/(\d{4}-\d{2})\.json$/);
      if (!match) continue;
      const [, keyYear, period] = match;

      if (yearParam && keyYear !== yearParam) continue;
      if (from && period < from) continue;
      if (to && period > to) continue;

      const res = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      const body = await res.Body?.transformToString();
      if (!body) continue;
      try {
        const data = JSON.parse(body) as {
          period: string;
          revenueCents: number;
          currency?: string;
          feeCents?: number;
        };
        byMonth.push({
          period: data.period,
          revenueCents: data.revenueCents ?? 0,
          currency: data.currency ?? "usd",
          feeCents: data.feeCents,
        });
      } catch {
        // skip invalid JSON
      }
    }

    byMonth.sort((a, b) => a.period.localeCompare(b.period));

    const byYearMap = new Map<string, number>();
    for (const m of byMonth) {
      const y = m.period.slice(0, 4);
      byYearMap.set(y, (byYearMap.get(y) ?? 0) + m.revenueCents);
    }
    const byYear = Array.from(byYearMap.entries())
      .map(([period, revenueCents]) => ({ period, revenueCents }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return NextResponse.json({ byMonth, byYear });
  } catch (err) {
    console.error("Revenue API error:", err);
    return NextResponse.json(
      { error: "Failed to load revenue data" },
      { status: 500 }
    );
  }
}
