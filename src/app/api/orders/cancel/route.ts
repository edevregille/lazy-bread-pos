import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/config/authOptions";

let _stripe: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_API_KEY as string);
  }
  return _stripe;
};

// PaymentIntent states Stripe lets us cancel; cancelling releases any hold on the card.
const CANCELABLE_STATUSES: Stripe.PaymentIntent.Status[] = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "requires_capture",
];

/**
 * Cancel an order: the customer changed their mind before delivery.
 * Permanently deletes the order document. The customer is not notified.
 *
 * - Refuses when the payment was already collected, so a charge never loses its order record
 *   (refund in Stripe first).
 * - If the order has an uncaptured PaymentIntent, cancels it first so the card hold is released.
 *   Orders placed through the SetupIntent flow have no PaymentIntent yet: nothing was charged.
 */
export async function POST(req: NextRequest) {
  // Deleting is destructive, so only signed-in POS users may do it.
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const apiGatewayUrl = process.env.SERVICE_ORDERS_MGT_API_URL;
  if (!apiGatewayUrl) {
    return NextResponse.json({ error: "Orders API URL not configured" }, { status: 500 });
  }

  let orderId: unknown;
  let stripePaymentIntentId: unknown;
  try {
    ({ orderId, stripePaymentIntentId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (typeof orderId !== "string" || !orderId) {
    return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
  }

  try {
    if (typeof stripePaymentIntentId === "string" && stripePaymentIntentId) {
      const paymentIntent = await getStripe().paymentIntents.retrieve(stripePaymentIntentId);

      if (paymentIntent.status === "succeeded") {
        return NextResponse.json(
          { error: "Payment was already collected. Refund it in Stripe before deleting this order." },
          { status: 409 }
        );
      }
      if (CANCELABLE_STATUSES.includes(paymentIntent.status)) {
        await getStripe().paymentIntents.cancel(stripePaymentIntentId, {
          cancellation_reason: "requested_by_customer",
        });
      } else if (paymentIntent.status !== "canceled") {
        // e.g. "processing": the charge is in flight, so don't delete the record now.
        return NextResponse.json(
          { error: `Payment is ${paymentIntent.status}. Try again in a few minutes.` },
          { status: 409 }
        );
      }
    }

    const response = await fetch(`${apiGatewayUrl}/orders`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 404) {
      // Already gone (deleted from another device): the outcome the user wanted.
      return NextResponse.json({ success: true, alreadyDeleted: true });
    }
    if (!response.ok) {
      throw new Error(data.message || data.error || `Orders API returned ${response.status}`);
    }

    console.log("Order cancelled and deleted", {
      orderId,
      by: session.user?.email,
      paymentIntentCancelled: Boolean(stripePaymentIntentId),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling order:", { orderId, error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel order" },
      { status: 500 }
    );
  }
}
