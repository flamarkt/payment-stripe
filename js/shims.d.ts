import {
    StripeElements,
    StripeCardElement,
    StripePaymentElement,
    PaymentIntentResult,
    StripeError
} from '@stripe/stripe-js';

declare module 'flamarkt/core/forum/layouts/CartLayout' {
    export default interface CartLayout {
        payWithStripe: boolean
        stripeClientSecret: string | null
        stripePaymentIntentSucceeded: boolean
        stripePaymentElements: StripeElements | null
        stripePaymentElement: StripeCardElement | StripePaymentElement | null
        stripeMessageEventListener: (event: MessageEvent) => void
        stripeCompleteIntent: (response: PaymentIntentResult | { error: StripeError }, noRecursion?: boolean) => void
    }
}
