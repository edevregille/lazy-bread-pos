import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get the API Gateway URL from environment variable
    const apiGatewayUrl = process.env.SERVICE_ORDERS_MGT_API_URL;
    
    if (!apiGatewayUrl) {
      return NextResponse.json(
        { error: 'Users API URL not configured' },
        { status: 500 }
      );
    }

    // Fetch users from the AWS API Gateway
    const response = await fetch(`${apiGatewayUrl}/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
