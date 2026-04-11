import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiGatewayUrl = process.env.SERVICE_ORDERS_MGT_API_URL;

  if (!apiGatewayUrl) {
    return NextResponse.json(
      { error: "SERVICE_ORDERS_MGT_API_URL is not configured" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.toString();

    const response = await fetch(
      `${apiGatewayUrl}/revenue-transactions${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Revenue transactions query proxy error:", error);
    return NextResponse.json(
      {
        error: "Failed to load revenue transactions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
