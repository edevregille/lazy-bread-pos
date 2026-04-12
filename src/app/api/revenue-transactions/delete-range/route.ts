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
    const response = await fetch(
      `${apiGatewayUrl}/revenue-transactions/delete-range`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
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
    console.error("Delete range proxy error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete transactions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
