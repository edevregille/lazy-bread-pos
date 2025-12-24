import { NextResponse, NextRequest } from "next/server";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_API_KEY as string);
  }
  return _stripe;
};

// Helper function to update order payment info (ID and status) in Firebase
async function updateOrderPaymentInfo(orderId: string, paymentIntentId: string, paymentStatus: string): Promise<void> {
  try {
    const ordersApiUrl = process.env.SERVICE_ORDERS_MGT_API_URL;
    if (!ordersApiUrl) {
      console.warn('SERVICE_ORDERS_MGT_API_URL not configured, cannot update order');
      return;
    }
    const updateResponse = await fetch(`${ordersApiUrl}/orders`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderId,
        paymentIntentId: paymentIntentId,
        stripePaymentStatus: paymentStatus
      })
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`Failed to update order ${orderId}:`, updateResponse.status, errorData);
    }
  } catch (updateError) {
    console.error('Error updating order with payment info:', updateError);
    // Don't fail the payment capture if order update fails
  }
}

export async function POST(req: NextRequest) {
  try {
    const { customerId, paymentMethodId, amount, orderId } = await req.json();
    const stripe = getStripe();
    let paymentIntent: Stripe.PaymentIntent;

    if (customerId && paymentMethodId && amount) {
      const amountInCents = Math.round(amount * 100);
      
      // Create payment intent off_session
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          orderId: orderId || '',
          orderType: 'online'
        }
      });

      // Update order in Firebase with payment intent ID and status
      if (orderId) {
        await updateOrderPaymentInfo(orderId, paymentIntent.id, paymentIntent.status);
      }
    } else {
      return NextResponse.json(
        { error: 'Either paymentIntentId or (customerId, paymentMethodId, amount) is required' },
        { status: 400 }
      );
    }
    
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
      // Handle specific Stripe errors
      if (error.code === 'payment_intent_authentication_required') {
        return NextResponse.json(
          { 
            error: 'Payment requires authentication', 
            message: 'The payment method requires additional authentication. Please try again.',
            code: error.code 
          },
          { status: 400 }
        );
      }
      
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