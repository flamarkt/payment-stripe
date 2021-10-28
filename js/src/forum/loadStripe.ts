import {Stripe} from '@stripe/stripe-js';
import {loadStripe} from '@stripe/stripe-js/pure';
import app from 'flarum/forum/app';

// confirmCardPayment requires the same instance of Stripe.js to be used between element creation and confirmation, so we'll store it here
let instance: Stripe | null = null;

export default async function (): Promise<Stripe> {
    if (!instance) {
        instance = await loadStripe(app.forum.attribute('flamarktStripePublishableKey'));

        // Not sure why loadStripe is type-hinted as possible null while the example don't mention it
        if (!instance) {
            throw new Error('Stripe.js failed to load');
        }
    }

    return instance;
}
