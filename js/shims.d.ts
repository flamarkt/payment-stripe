// Mithril
import Mithril from 'mithril';

declare global {
    const m: Mithril.Static;
}

import ForumApplication from 'flarum/forum/ForumApplication';
import AdminApplication from 'flarum/admin/AdminApplication';

declare global {
    const app: ForumApplication & AdminApplication;
}

// Fix wrong signatures from Flarum
declare module 'flarum/common/Translator' {
    export default interface Translator {
        // Make second parameter optional
        trans(id: any, parameters?: any): any;
    }
}

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
