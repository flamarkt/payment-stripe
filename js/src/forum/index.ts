import {PaymentIntentResult, Stripe, StripeError} from '@stripe/stripe-js';
import app from 'flarum/forum/app';
import {extend, override} from 'flarum/common/extend';
import CartLayout from 'flamarkt/core/forum/layouts/CartLayout';
import OrderFactPayment from 'flamarkt/core/forum/components/OrderFactPayment';
import Button from 'flarum/common/components/Button';
import extractText from 'flarum/common/utils/extractText';
import {forum} from './compat';
import IframeModal from './components/IframeModal';
import loadStripe from './loadStripe';

export {
    forum,
};

app.initializers.add('flamarkt-payment-stripe', () => {
    CartLayout.prototype.stripeEmbeddedCheckoutEnabled = function (): boolean {
        // Currently hard-coded to opposite of hosted checkout
        if (app.forum.attribute('flamarktStripeHostedCheckout')) {
            return false;
        }

        // Only enable when something is present in the cart
        // Otherwise our code that generates the payment intent couldn't proceed anyway
        return (this.attrs.cart?.productCount() || 0) > 0;
    };

    CartLayout.prototype.stripeHostedCheckoutEnabled = function (): boolean {
        // We don't disable the hosted checkout on an empty cart as it wouldn't improve performance
        // and the submit button is already disabled by Flamarkt if there are no products in the cart
        return !!app.forum.attribute('flamarktStripeHostedCheckout');
    };

    CartLayout.prototype.stripeInstantPaymentsEnabled = function (): boolean {
        return true;
    };

    CartLayout.prototype.stripeOtherPaymentsEnabled = function (): boolean {
        return true;
    };

    CartLayout.prototype.stripeCardOnlyMode = function (): boolean {
        return !!app.forum.attribute('flamarktStripeCardOnly');
    };

    CartLayout.prototype.stripeRetrieveClientSecret = function (commitToOrder: boolean = false): Promise<void> {
        // TODO: show dedicated error message instead of native HTTP error if there's an error retrieving token
        return app.request<any>({
            method: 'POST',
            url: app.forum.attribute('apiUrl') + '/flamarkt/stripe-payment-intent',
            body: {
                commitToOrder,
            },
            errorHandler: this.cartSubmissionErrorHandler,
        }).then(async response => {
            this.stripeClientSecret = response.client_secret;
            m.redraw();
        });
    };

    CartLayout.prototype.stripeSubmitHostedCheckout = function (event: Event): void {
        event.preventDefault();
        this.stripeSubmitting = 'hosted';
        m.redraw();

        app.request<{ url: string }>({
            method: 'POST',
            url: app.forum.attribute('apiUrl') + '/flamarkt/stripe-hosted-checkout',
            errorHandler: this.cartSubmissionErrorHandler,
        }).then(response => {
            window.location.href = response.url;
        }).catch(this.afterFailedSubmit.bind(this));
    };

    CartLayout.prototype.stripeSubmitEmbeddedCheckout = async function (event: Event): Promise<void> {
        event.preventDefault();

        // Do this at the very beginning, so it doesn't end up in the asynchronous part (no additional redraw needed)
        this.stripeSubmitting = 'embedded';

        try {
            await this.stripeRetrieveClientSecret(true);
        } catch (error) {
            // In case there's an error, we want to stop right here. Message is already displayed by stripeRetrieveClientSecret()
            this.stripeSubmitting = null;
            m.redraw();
            throw error;
        }

        // If somehow there is still no secret even without stripeRetrieveClientSecret() throwing an error, cancel
        if (!this.stripeClientSecret) {
            this.stripeSubmitting = null;
            m.redraw();
            return;
        }

        const stripe = await loadStripe();

        let response!: PaymentIntentResult | { error: StripeError };

        try {
            if (this.stripeCardOnlyMode()) {
                response = await stripe.confirmCardPayment(this.stripeClientSecret!, {
                    payment_method: {card: this.stripePaymentCardElement!},
                    return_url: app.forum.attribute('baseUrl') + '/flamarkt/stripe-iframe-complete',
                }, {handleActions: false});
            } else {
                const confirmPaymentOptions = {
                    elements: this.stripePaymentElements!,
                    confirmParams: {
                        return_url: app.forum.attribute('baseUrl') + '/flamarkt/stripe-redirect',
                    },
                };

                // use if block because otherwise Typescript just isn't happy with the typings on the options object if
                // manipulated through a ternary operator
                if (app.forum.attribute('flamarktStripeAlwaysRedirect')) {
                    response = await stripe.confirmPayment({
                        ...confirmPaymentOptions,
                        redirect: 'always',
                    });
                } else {
                    response = await stripe.confirmPayment({
                        ...confirmPaymentOptions,
                        redirect: 'if_required',
                    });
                }
            }
        } catch (error) {
            // TODO: better message? what might happen here?
            alert(error);

            throw error;
        }

        this.stripeCompleteIntent(response);
    };

    extend(CartLayout.prototype, 'oninit', function () {
        this.stripeEmbeddedInitialized = false;
        this.stripeEmbeddedLoading = true;
        this.stripeSubmitting = null;
        this.stripeClientSecret = null;
        this.stripePaymentElements = null;
        this.stripePaymentElement = null;
        this.stripePaymentCardElement = null;
        this.stripePaymentRequest = null;
        this.stripePaymentRequestButtonElement = null;
    });

    extend(CartLayout.prototype, 'oncreate', function () {
        this.stripeMessageEventListener = async (event: MessageEvent) => {
            if (event.data === '3DS-authentication-complete' && this.stripeClientSecret) {
                app.modal.close();

                const response = await (await loadStripe()).retrievePaymentIntent(this.stripeClientSecret);

                this.stripeCompleteIntent(response, true);
            }
        };

        window.addEventListener('message', this.stripeMessageEventListener, false);
    });

    extend(CartLayout.prototype, 'onremove', function () {
        window.removeEventListener('message', this.stripeMessageEventListener);
    });

    extend(CartLayout.prototype, 'instantPaymentOptions', function (items) {
        if (this.stripeHostedCheckoutEnabled()) {
            const loading = this.stripeSubmitting === 'hosted';
            items.add('stripe-checkout', Button.component({
                className: 'Button Button--primary',
                onclick: this.stripeSubmitHostedCheckout.bind(this),
                disabled: this.submitDisabled(),
                loading,
                icon: 'fab fa-stripe', // Icon not visible with default Flarum styling for .Button--primary
            }, app.translator.trans('flamarkt-payment-stripe.forum.cart.submit.hosted' + (loading ? 'Loading' : ''))));
        }

        if (this.stripePaymentRequestButtonElement) {
            const totalInformation = this.stripePaymentRequestTotal();

            // There's no good place to update this value as soon as it changes
            // But having this code anywhere in the view, it should react quickly enough
            // By placing it here we don't need additional conditions to check if the payment request is being used
            if (totalInformation.amount !== this.stripePaymentRequestLastAmount) {
                this.stripePaymentRequest!.update({
                    total: totalInformation,
                });
            }

            items.add('stripe', m('#js-stripe-payment-request-button', {
                oncreate: () => {
                    this.stripePaymentRequestButtonElement!.mount('#js-stripe-payment-request-button');
                },
            }));
        }
    });

    extend(CartLayout.prototype, 'otherPaymentOptions', function (items) {
        if (this.stripePaymentElement) {
            items.add('stripe', m('#js-stripe-payment-element', {
                oncreate: () => {
                    this.stripePaymentElement!.mount('#js-stripe-payment-element');
                },
            }));
        }

        if (this.stripePaymentCardElement) {
            items.add('stripe-card', m('#js-stripe-payment-card-element', {
                oncreate: () => {
                    this.stripePaymentCardElement!.mount('#js-stripe-payment-card-element');
                },
            }));
        }

        if (this.stripePaymentElement || this.stripePaymentCardElement) {
            const loading = this.stripeSubmitting === 'embedded';

            items.add('stripe-submit', Button.component({
                className: 'Button Button--primary',
                onclick: this.stripeSubmitEmbeddedCheckout.bind(this),
                disabled: this.submitDisabled(),
                loading,
            }, app.translator.trans('flamarkt-payment-stripe.forum.cart.submit.embedded' + (loading ? 'Loading' : ''))));
        }
    });

    CartLayout.prototype.stripeCompleteIntent = async function (this: CartLayout, response: PaymentIntentResult | { error: StripeError }, noRecursion: boolean = false) {
        // When using confirmCardPayment, there might be no errors
        // This will also be used by confirmPayment when a redirect isn't required
        if (!response.error) {
            if (response.paymentIntent && response.paymentIntent.next_action && response.paymentIntent.next_action.redirect_to_url) {
                app.modal.show(IframeModal, {
                    url: response.paymentIntent.next_action.redirect_to_url.url,
                });

                return;
            }

            this.stripeSubmitting = 'embedded';
            m.redraw();

            this.submitOrder({
                payWithStripe: true,
            });

            return;
        }

        const {error} = response;

        // This error can happen if we are back on the page after a failed iframe redirect
        // We'll check the state of the intent again and finish the submission if necessary
        // The noRecursion parameter prevents an infinite loop
        if (!noRecursion && error.type === 'invalid_request_error' && error.code === 'payment_intent_unexpected_state') {
            const response = await (await loadStripe()).retrievePaymentIntent(this.stripeClientSecret!);

            this.stripeCompleteIntent(response, true);

            return;
        }

        // TODO: show message next to card input instead of an alert
        // This code should only execute if there was an error (user is already redirected otherwise)
        app.alerts.show({
                type: 'error',
            }, (error.type === 'card_error' || error.type === 'validation_error') ?
                error.message :
                app.translator.trans('flamarkt-payment-stripe.forum.cart.alert.stripeConfirmationError')
        );

        this.stripeSubmitting = null;
        m.redraw();
    }

    override(CartLayout.prototype, 'paymentsLoading', function (original: any) {
        if (this.stripeEmbeddedLoading) {
            return true;
        }

        return original();
    });

    override(CartLayout.prototype, 'instantPaymentOrLabel', function (original: any) {
        // If Stripe is in use, it's very likely that the only "other" payment method is Stripe
        // If cards are the only option, it makes sense to switch the label
        if (app.forum.attribute('flamarktStripeCardOnly') && this.stripeOtherPaymentsEnabled()) {
            return app.translator.trans('flamarkt-payment-stripe.forum.cart.payment.instantOrCard');
        }

        return original();
    });

    override(CartLayout.prototype, 'afterFailedSubmit', function (original: any) {
        this.stripeSubmitting = null;

        return original();
    });

    override(CartLayout.prototype, 'formDisabled', function (original: any) {
        if (this.stripeSubmitting) {
            return true;
        }

        return original();
    });

    CartLayout.prototype.initializeEmbeddedStripe = function () {
        // We check whether already initialized because the method can be called from either onCartAvailable or onContinueReset, and one doesn't exclude the other
        if (this.stripeEmbeddedInitialized || this.continue) {
            return;
        }

        // We need to keep the "loading" value to true until this code runs because the value of the enabled state depends on the cart being available
        if (!this.stripeEmbeddedCheckoutEnabled()) {
            this.stripeEmbeddedLoading = false;

            return;
        }

        this.stripeEmbeddedInitialized = true;

        const promisesAsSoonAsCartIsAvailable: [Promise<Stripe>, ...Promise<void>[]] = [loadStripe()];

        // The Stripe payment/card elements require the client secret at page load
        if (this.stripeOtherPaymentsEnabled()) {
            promisesAsSoonAsCartIsAvailable.push(this.stripeRetrieveClientSecret());
        }

        Promise.all(promisesAsSoonAsCartIsAvailable).then(([stripe]) => {
            this.stripePaymentElements = stripe.elements({clientSecret: this.stripeClientSecret || undefined});

            if (this.stripeOtherPaymentsEnabled()) {
                if (this.stripeCardOnlyMode()) {
                    this.stripePaymentCardElement = this.stripePaymentElements.create('card');
                } else {
                    this.stripePaymentElement = this.stripePaymentElements.create('payment');
                }
            }

            if (this.stripeInstantPaymentsEnabled()) {
                const paymentRequestOptions = this.stripePaymentRequestOptions();

                // Save the value for reference in the view later
                this.stripePaymentRequestLastAmount = paymentRequestOptions.total.amount;

                this.stripePaymentRequest = stripe.paymentRequest(paymentRequestOptions);

                this.stripePaymentRequest.canMakePayment().then(result => {
                    if (result) {
                        this.stripePaymentRequestButtonElement = this.stripePaymentElements!.create('paymentRequestButton', {
                            paymentRequest: this.stripePaymentRequest!,
                        });

                        this.stripePaymentRequest!.on('paymentmethod', async (ev) => {
                            // Even if the secret is already available, this ensures the intent is updated with
                            // the latest cart amount before we proceed
                            await this.stripeRetrieveClientSecret(true);

                            // stripeRetrieveClientSecret() takes care of showing an error if necessary
                            if (!this.stripeClientSecret) {
                                return;
                            }

                            // Confirm the PaymentIntent without handling potential next actions (yet).
                            const response = await stripe.confirmCardPayment(this.stripeClientSecret, {
                                payment_method: ev.paymentMethod.id,
                            }, {handleActions: false});

                            this.stripeCompleteIntent(response);
                        });
                    }

                    // If instant payments are enabled, wait until the check is done to mark loading complete
                    this.stripeEmbeddedLoading = false;
                    m.redraw();
                });
            } else {
                // If instant payments are disabled, we can mount the card elements right away
                this.stripeEmbeddedLoading = false;
                m.redraw();
            }
        });
    };

    extend(CartLayout.prototype, 'onCartAvailable', function () {
        this.initializeEmbeddedStripe();

        if (this.continue === 'stripe-cancelled') {
            app.alerts.show(app.translator.trans('flamarkt-payment-stripe.forum.cart.alert.stripeCancelled'));
            this.resetContinue();
        }

        if (this.continue === 'stripe') {
            if (this.stripeHostedCheckoutEnabled() || this.stripeEmbeddedCheckoutEnabled()) {
                // Whether it's hosted or embedded method will be checked server-side
                // No need to set one of the submitting boolean variables since the "continuing" mode is already locking the form
                this.submitOrder({
                    payWithStripe: true,
                });
            } else {
                // Natively, Stripe will always be available but if an extension extends the enabled() methods to selectively
                // disable Stripe on specific orders, we want to gracefully handle the "continue" flag anyway
                this.resetContinue();
            }
        }
    });

    extend(CartLayout.prototype, 'onContinueReset', CartLayout.prototype.initializeEmbeddedStripe);

    CartLayout.prototype.stripePaymentRequestOptions = function () {
        return {
            country: 'CH',
            currency: 'chf',
            total: this.stripePaymentRequestTotal(),
            requestPayerName: true,
            requestPayerEmail: false,
        };
    };

    CartLayout.prototype.stripePaymentRequestTotal = function () {
        return {
            label: extractText(app.translator.trans('flamarkt-payment-stripe.forum.cart.paymentRequest.total')),
            // TODO: update when cart is modified
            amount: this.attrs.cart?.amountDueAfterPartial() || 0,
        };
    };

    override(OrderFactPayment.prototype, 'label', function (original) {
        if ((this.attrs.payment.method() || '').startsWith('stripe-')) {
            // TODO: option to use icon
            if (this.attrs.payment.method()!.endsWith('-hold')) {
                return app.translator.trans('flamarkt-payment-stripe.forum.order.paymentLabelHold');
            }

            if (this.attrs.payment.method()!.endsWith('-release')) {
                return app.translator.trans('flamarkt-payment-stripe.forum.order.paymentLabelRelease');
            }

            return app.translator.trans('flamarkt-payment-stripe.forum.order.paymentLabel');
        }

        return original();
    });
})
;
