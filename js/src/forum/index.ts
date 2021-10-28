import {PaymentIntentResult, StripeCardElement, StripeError} from '@stripe/stripe-js';
import {extend, override} from 'flarum/common/extend';
import CartLayout from 'flamarkt/core/forum/layouts/CartLayout';
import ItemList from 'flarum/common/utils/ItemList';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import {forum} from './compat';
import IframeModal from './components/IframeModal';
import loadStripe from './loadStripe';

export {
    forum,
};

app.initializers.add('flamarkt-payment-stripe', () => {
    extend(CartLayout.prototype, 'oninit', function (this: CartLayout) {
        this.payWithStripe = false;
        this.stripeClientSecret = null;
        this.stripePaymentIntentSucceeded = false;
        this.stripePaymentElements = null;
        this.stripePaymentElement = null;
    });

    extend(CartLayout.prototype, 'oncreate', function (this: CartLayout) {
        this.stripeMessageEventListener = async (event: MessageEvent) => {
            if (event.data === '3DS-authentication-complete' && this.stripeClientSecret) {
                app.modal.close();

                const response = await (await loadStripe()).retrievePaymentIntent(this.stripeClientSecret);

                this.stripeCompleteIntent(response, true);
            }
        };

        window.addEventListener('message', this.stripeMessageEventListener, false);
    });


    extend(CartLayout.prototype, 'onremove', function (this: CartLayout) {
        window.removeEventListener('message', this.stripeMessageEventListener);
    });

    extend(CartLayout.prototype, 'sectionPayment', function (this: CartLayout, items: ItemList) {
        items.add('stripe', m('.Form-group', [
            m('label', [
                m('input', {
                    type: 'checkbox',
                    checked: this.payWithStripe,
                    onchange: () => {
                        this.payWithStripe = !this.payWithStripe;

                        if (this.payWithStripe && !this.stripeClientSecret && !app.forum.attribute('flamarktStripeHostedCheckout')) {
                            app.request({
                                method: 'GET',
                                url: app.forum.attribute('apiUrl') + '/flamarkt/stripe-payment-intent',
                            }).then(async response => {
                                this.stripeClientSecret = response.client_secret;
                                this.stripePaymentElements = (await loadStripe()).elements({clientSecret: this.stripeClientSecret!});
                                if (app.forum.attribute('flamarktStripeCardOnly')) {
                                    this.stripePaymentElement = this.stripePaymentElements.create('card');
                                } else {
                                    this.stripePaymentElement = this.stripePaymentElements.create('payment');
                                }
                                m.redraw();
                            });
                        }
                    },
                    disabled: this.submitting,
                }),
                ' Pay with Stripe',
            ]),
            this.payWithStripe && !app.forum.attribute('flamarktStripeHostedCheckout') ? [
                this.stripePaymentElement ? m('#stripe-payment-element', {
                    oncreate: () => {
                        this.stripePaymentElement!.mount('#stripe-payment-element');
                    },
                }) : LoadingIndicator.component(),
            ] : null,
        ]));
    });

    extend(CartLayout.prototype, 'data', function (this: CartLayout, data: any) {
        data.payWithStripe = this.payWithStripe;
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

            this.submitting = true;
            m.redraw();

            app.store.createRecord('flamarkt-orders')
                .save(this.data())
                .then(this.afterSuccessfulSubmit.bind(this))
                .catch(this.afterFailedSubmit.bind(this));

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

        // This code should only execute if there was an error (user is already redirected otherwise)
        if (error.type === 'card_error' || error.type === 'validation_error') {
            alert(error.message);
        } else {
            alert('An unexpected Stripe payment confirmation error occurred.');
        }

        this.submitting = false;
        m.redraw();
    }

    override(CartLayout.prototype, 'onsubmit', function (this: CartLayout, original: any, event: Event) {
        if (this.payWithStripe && app.forum.attribute('flamarktStripeHostedCheckout')) {
            event.preventDefault();

            const form = document.createElement('form');
            form.method = 'POST';
            form.action = app.forum.attribute('baseUrl') + '/flamarkt/stripe-checkout';
            const field = document.createElement('input');
            field.type = 'hidden';
            field.name = 'csrfToken';
            field.value = app.session.csrfToken!;
            form.appendChild(field);
            document.body.appendChild(form);
            form.submit();

            return;
        }

        if (!this.payWithStripe || this.stripePaymentIntentSucceeded) {
            return original(event);
        }

        event.preventDefault();

        if (!this.stripeClientSecret) {
            alert('There was an issue retrieving the Stripe payment intent token');
            return;
        }

        this.submitting = true;

        (async () => {
            const stripe = await loadStripe();

            let response!: PaymentIntentResult | { error: StripeError };

            try {
                if (app.forum.attribute('flamarktStripeCardOnly')) {
                    response = await stripe.confirmCardPayment(this.stripeClientSecret!, {
                        payment_method: {card: this.stripePaymentElement as StripeCardElement},
                        return_url: app.forum.attribute('baseUrl') + '/flamarkt/stripe-iframe-complete',
                    }, {handleActions: false});
                } else {
                    response = await stripe.confirmPayment({
                        elements: this.stripePaymentElements!,
                        confirmParams: {
                            return_url: app.forum.attribute('baseUrl') + '/flamarkt/stripe-redirect',
                        },
                        redirect: app.forum.attribute('flamarktStripeAlwaysRedirect') ? 'always' : 'if_required',
                    });
                }
            } catch (error) {
                // TODO: better message? what might happen here?
                alert(error);

                throw error;
            }

            this.stripeCompleteIntent(response);
        })();
    });
});
