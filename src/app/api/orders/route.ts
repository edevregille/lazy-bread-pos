import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get the API Gateway URL from environment variable
    const apiGatewayUrl = process.env.ORDERS_API_URL;
    
    if (!apiGatewayUrl) {
      return NextResponse.json(
        { error: 'Orders API URL not configured' },
        { status: 500 }
      );
    }

    // Fetch orders from the AWS API Gateway
    const response = await fetch(`${apiGatewayUrl}/orders`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 