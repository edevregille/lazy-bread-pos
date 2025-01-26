import Stripe from 'stripe';

let _stripe: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_API_KEY as string);
  }
  return _stripe;
};

export async function fetchReader () {
    return (await getStripe().terminal.readers.list())?.data;
}

export async function processPayment (amount: number, reader_id: string) {
    try {
        const paymentIntent = await getStripe().paymentIntents.create({
            currency: 'usd',
            payment_method_types: ['card_present'],
            capture_method: 'automatic',
            amount: amount*100,
        });
        await getStripe().terminal.readers.processPaymentIntent(
            reader_id,
            {
              payment_intent: paymentIntent.id,
            }
        );
        return {
            payment_intent: paymentIntent.id,
        }
    } catch (error) {
        return {
            error: true,
            message: `Error processing the payment ${JSON.stringify(error)}`
        }
    }
}


export async function checkStatus(payment_intent_id: string) {
    const paymentIntent = await getStripe().paymentIntents.retrieve(payment_intent_id);
    return { status: paymentIntent.status }
}