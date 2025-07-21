import { NextResponse, NextRequest } from "next/server";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_API_KEY as string);
  }
  return _stripe;
};

export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId } = await req.json();
    
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      );
    }

    // Capture the payment intent
    const paymentIntent = await getStripe().paymentIntents.capture(paymentIntentId);
    
    return NextResponse.json({
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      }
    });
  } catch (error) {
    console.error('Error capturing payment intent:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { 
          error: 'Stripe error', 
          message: error.message,
          code: error.code 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to capture payment intent' },
      { status: 500 }
    );
  }
} 