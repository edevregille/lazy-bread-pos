import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiGatewayUrl = process.env.SERVICE_ORDERS_MGT_API_URL;

  if (!apiGatewayUrl) {
    return NextResponse.json(
      { error: "SERVICE_ORDERS_MGT_API_URL is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.text();
    const contentType = req.headers.get("content-type") || "text/csv";

    const response = await fetch(`${apiGatewayUrl}/revenue-transactions`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
      },
      body,
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Revenue transactions upload proxy error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload revenue data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
