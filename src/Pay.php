<?php

namespace Flamarkt\StripePayment;

use Flamarkt\Core\Cart\Cart;
use Flamarkt\Core\Order\Order;
use Flamarkt\Core\Order\OrderBuilder;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\Translator;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Arr;

class Pay
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected Translator                  $translator
    )
    {
    }

    public function __invoke(OrderBuilder $builder, Order $order, User $actor, Cart $cart, array $data): void
    {
        // Don't try billing in pretend mode
        if ($builder->pretend) {
            return;
        }

        if (!Arr::get($data, 'attributes.payWithStripe')) {
            return;
        }

        if ($this->settings->get('flamarkt-payment-stripe.hostedCheckout')) {
            // The request should always be available outside "pretend" mode, but we'll handle it cleanly just in case
            if (!$builder->request) {
                throw new ValidationException([
                    'payWithStripe' => 'Cannot access Flarum session data in payment process',
                ]);
            }

            /**
             * @var Session $requestSession
             */
            $requestSession = $builder->request->getAttribute('session');

            $checkoutId = (string)$requestSession->get('stripeSession');

            // TODO: special error handler? The default Flarum error handler should kick in if the value is invalid
            $session = \Stripe\Checkout\Session::retrieve($checkoutId, [
                'expand' => [
                    'payment_intent',
                ],
            ]);

            // TODO: if the session ID was stored on the cart object, we could verify this without hitting Stripe API
            // There probably wouldn't be too much harm allowing any session ID here but this would allow scanning for valid IDs from other users and potentially hijack their session
            if (Arr::get($session->metadata, 'flamarkt-cart-uid') !== $cart->uid) {
                throw new ValidationException([
                    'payment' => $this->translator->trans('flamarkt-payment-stripe.api.pay.hostedCheckout.invalidLink'),
                ]);
            }

            // TODO: different test to validate a successful capture?
            if (!$session || $session->payment_status !== 'paid') {
                throw new ValidationException([
                    'payment' => $this->translator->trans('flamarkt-payment-stripe.api.pay.hostedCheckout.invalidStatus'),
                ]);
            }

            $builder->addPayment('stripe-session' . ($session->payment_intent->status === 'requires_capture' ? '-hold' : ''), $session->amount_total, $session->id);
        } else {
            $intent = CartUtil::retrieveOrCreatePaymentIntent($cart);

            // TODO: accept "processing" as a valid status?
            if ($intent->status !== 'succeeded' && $intent->status !== 'requires_capture') {
                throw new ValidationException([
                    'payment' => $this->translator->trans('flamarkt-payment-stripe.api.pay.intent.invalidStatus'),
                ]);
            }

            $builder->addPayment('stripe-intent' . ($intent->status === 'requires_capture' ? '-hold' : ''), $intent->amount, $intent->id);
        }
    }
}
