import { NextResponse, NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { orderId, status } = await req.json();
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    // Update the order status in Firebase
    const apiGatewayUrl = process.env.ORDERS_API_URL;
    if (!apiGatewayUrl) {
        return NextResponse.json(
          { error: 'Orders API URL not configured' },
          { status: 500 }
        );
    }
    // Update order from the AWS API Gateway
    const response = await fetch(`${apiGatewayUrl}/orders`, {
        method: 'PUT',
        headers: {
        'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId, status }),
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json(
      { error: 'Failed to update order status' },
      { status: 500 }
    );
  }
} 