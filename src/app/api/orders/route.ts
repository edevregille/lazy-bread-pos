import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get the API Gateway URL from environment variable
    const apiGatewayUrl = process.env.SERVICE_ORDERS_MGT_API_URL;
    
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
      // Try to get more details from the response
      let errorDetails = response.statusText;
      try {
        const errorBody = await response.text();
        if (errorBody) {
          errorDetails = `${response.statusText}: ${errorBody}`;
        }
      } catch (e) {
        // Ignore if we can't parse the error body
      }
      console.error(`Orders API error: ${response.status} ${errorDetails}`);
      throw new Error(`Failed to fetch orders: ${response.status} ${errorDetails}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching orders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to fetch orders', 
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 