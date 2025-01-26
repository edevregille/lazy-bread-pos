import { NextResponse, NextRequest } from "next/server";
import Stripe from "stripe";
import { calculateCartTotal } from "@/lib/utils";
import { products } from "@/config/config";
let _stripe: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_API_KEY as string);
  }
  return _stripe;
};

export async function POST(req: NextRequest) {
  const { cart, email, reader_id  } = await req.json();
  
  try {
    const customer = email
      ? await getStripe().customers.create({ email })
      : null;

    const paymentIntent = await getStripe().paymentIntents.create({
      currency: "usd",
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      amount: calculateCartTotal(products, cart) * 100,
      customer: customer && customer.id ? customer.id : undefined,
    });
    await getStripe().terminal.readers.processPaymentIntent(reader_id, {
      payment_intent: paymentIntent.id,
    });
    return NextResponse.json({id: paymentIntent.id}, { status: 200 });
  } catch (error) {
    console.log(error)
    return new NextResponse(null, {
        status: 400,
      });
  }
}