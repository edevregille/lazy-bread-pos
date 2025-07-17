import { NextResponse } from "next/server";

import Stripe from "stripe";
let _stripe: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_API_KEY as string);
  }
  return _stripe;
};

export async function GET() {
  try {
    // Check if Stripe API key is configured
    if (!process.env.STRIPE_API_KEY) {
      return NextResponse.json(
        { error: "Stripe API key not configured" },
        { status: 500 }
      );
    }

    const stripe = getStripe();
    const readers = (await stripe.terminal.readers.list())?.data || [];
    
    return NextResponse.json({ readers }, { status: 200 });
  } catch (error) {
    console.error('Error fetching readers:', error);
    
    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to fetch terminal readers" },
      { status: 500 }
    );
  }
}