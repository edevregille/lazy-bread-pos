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
  const { paymentId } = await req.json();
  
  const paymentIntent =
  await getStripe().paymentIntents.retrieve(paymentId);
  return NextResponse.json({status: paymentIntent.status}, { status: 200 });
}

