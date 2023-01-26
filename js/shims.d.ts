import {
    StripeElements,
    StripeCardElement,
    StripePaymentElement,
    StripePaymentRequestButtonElement,
    PaymentIntentResult,
    PaymentRequest,
    StripeError
} from '@stripe/stripe-js';
import {PaymentRequestItem, PaymentRequestOptions} from "@stripe/stripe-js/types/stripe-js/payment-request";

declare module 'flamarkt/core/forum/layouts/CartLayout' {
    export default interface CartLayout {
        stripeEmbeddedInitialized: boolean
        stripeEmbeddedLoading: boolean
        stripeSubmitting: string | null
        stripeClientSecret: string | null
        stripePaymentElements: StripeElements | null
        stripePaymentElement: StripePaymentElement | null
        stripePaymentCardElement: StripeCardElement | null
        stripePaymentRequest: PaymentRequest | null
        stripePaymentRequestLastAmount: number | null
        stripePaymentRequestButtonElement: StripePaymentRequestButtonElement | null

        stripeRetrieveClientSecret(commitToOrder?: boolean): Promise<void>

        stripeSubmitHostedCheckout(event: Event): void

        stripeSubmitEmbeddedCheckout(event: Event): Promise<void>

        stripeMessageEventListener: (event: MessageEvent) => void
        stripeCompleteIntent: (response: PaymentIntentResult | { error: StripeError }, noRecursion?: boolean) => void

        stripeEmbeddedCheckoutEnabled(): boolean

        stripeHostedCheckoutEnabled(): boolean

        stripeInstantPaymentsEnabled(): boolean

        stripeOtherPaymentsEnabled(): boolean

        stripeCardOnlyMode(): boolean

        initializeEmbeddedStripe(): void

        stripePaymentRequestOptions(): PaymentRequestOptions

        stripePaymentRequestTotal(): PaymentRequestItem
    }
}
