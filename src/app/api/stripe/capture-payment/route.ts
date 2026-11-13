import { NextResponse, NextRequest } from "next/server";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_API_KEY as string);
  }
  return _stripe;
};

// Stripe rejects charges below $0.50 USD
const MIN_CHARGE_AMOUNT = 0.5;
// Stripe metadata values are capped at 500 characters
const MAX_METADATA_LENGTH = 500;

interface AdjustedItem {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
}

interface OrderAdjustment {
  amountCollected: number;
  originalAmount?: number;
  adjustmentReason?: string;
  adjustedItems?: AdjustedItem[];
}

const toCents = (amount: number): number => Math.round(amount * 100);

// Helper function to update order payment info (ID and status) in Firebase
async function updateOrderPaymentInfo(
  orderId: string,
  paymentIntentId: string,
  paymentStatus: string,
  adjustment: OrderAdjustment
): Promise<void> {
  try {
    const ordersApiUrl = process.env.SERVICE_ORDERS_MGT_API_URL;
    if (!ordersApiUrl) {
      console.warn('SERVICE_ORDERS_MGT_API_URL not configured, cannot update order');
      return;
    }
    // amountCollected records what was actually charged, which can be less than the
    // order total when an item was short at delivery.
    const updateResponse = await fetch(`${ordersApiUrl}/orders`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderId,
        paymentIntentId: paymentIntentId,
        stripePaymentStatus: paymentStatus,
        amountCollected: adjustment.amountCollected,
        ...(adjustment.originalAmount !== undefined && { originalAmount: adjustment.originalAmount }),
        ...(adjustment.adjustmentReason && { adjustmentReason: adjustment.adjustmentReason }),
        ...(adjustment.adjustedItems && { adjustedItems: adjustment.adjustedItems })
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
    const {
      customerId,
      paymentMethodId,
      amount,
      orderId,
      originalAmount,
      adjustmentReason,
      adjustedItems
    } = await req.json();
    const stripe = getStripe();
    let paymentIntent: Stripe.PaymentIntent;

    if (customerId && paymentMethodId && amount) {
      // The amount can be adjusted at delivery time (e.g. a product sold out), so it is
      // validated here rather than trusting whatever the client sent.
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < MIN_CHARGE_AMOUNT) {
        return NextResponse.json(
          { error: `Amount must be a number of at least $${MIN_CHARGE_AMOUNT.toFixed(2)}` },
          { status: 400 }
        );
      }

      const hasOriginalAmount = typeof originalAmount === 'number' && Number.isFinite(originalAmount);
      if (hasOriginalAmount && toCents(amount) > toCents(originalAmount)) {
        return NextResponse.json(
          { error: 'Amount cannot be greater than the original order total' },
          { status: 400 }
        );
      }

      const amountInCents = toCents(amount);
      const isAdjusted = hasOriginalAmount && amountInCents !== toCents(originalAmount);
      const reason = typeof adjustmentReason === 'string'
        ? adjustmentReason.trim().slice(0, MAX_METADATA_LENGTH)
        : '';

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
          orderType: 'online',
          ...(isAdjusted && {
            originalAmount: originalAmount.toFixed(2),
            adjustedAmount: amount.toFixed(2),
            ...(reason && { adjustmentReason: reason })
          })
        }
      });

      // Update order in Firebase with payment intent ID and status
      if (orderId) {
        await updateOrderPaymentInfo(orderId, paymentIntent.id, paymentIntent.status, {
          amountCollected: amount,
          ...(hasOriginalAmount && { originalAmount }),
          ...(isAdjusted && reason && { adjustmentReason: reason }),
          ...(isAdjusted && Array.isArray(adjustedItems) && { adjustedItems })
        });
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