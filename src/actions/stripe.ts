import { Cart } from "@/app/types";
import { calculateCartTotal } from "@/lib/utils";
import Stripe from "stripe";
import { products } from "@/config/config";

let _stripe: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_API_KEY as string);
  }
  return _stripe;
};

export async function fetchReader() {
  return (await getStripe().terminal.readers.list())?.data;
}

export async function processPayment(
  cart: Cart,
  email: string | null,
  reader_id: string,
) {
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
    return {
      payment_intent: paymentIntent.id,
    };
  } catch (error) {
    return {
      error: true,
      message: `Error processing the payment ${JSON.stringify(error)}`,
    };
  }
}

export async function checkStatus(payment_intent_id: string) {
  const paymentIntent =
    await getStripe().paymentIntents.retrieve(payment_intent_id);
  return { status: paymentIntent.status };
}
