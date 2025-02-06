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
  const readers = (await getStripe().terminal.readers.list())?.data;
  return NextResponse.json({readers}, { status: 200 });
}