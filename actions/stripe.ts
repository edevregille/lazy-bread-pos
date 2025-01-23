import Stripe from 'stripe';

const STRIPE_API_KEY =process.env["STRIPE_API_KEY"] || 'sk_test_51Qgf3NLAdquGgqLtscpfPNTwcOa4iiHVCOgb0aoFSgUKEya4ctryBCCmX1IUYN0UfSZuVqMMtgG3iurKDCa85NbG00KjWYZjQQ'

const stripe = new Stripe(STRIPE_API_KEY);


export async function fetchReader () {
    return (await stripe.terminal.readers.list())?.data;
}

export async function processPayment (amount: number, reader_id: string) {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            currency: 'usd',
            payment_method_types: ['card_present'],
            capture_method: 'automatic',
            amount: amount*100,
        });
        await stripe.terminal.readers.processPaymentIntent(
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
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    return { status: paymentIntent.status }
}