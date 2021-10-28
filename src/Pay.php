<?php

namespace Flamarkt\StripePayment;

use Flamarkt\Core\Cart\Cart;
use Flamarkt\Core\Order\Order;
use Flamarkt\Core\Order\OrderBuilder;
use Flarum\Foundation\ValidationException;
use Flarum\User\User;
use Illuminate\Support\Arr;

class Pay
{
    public function __invoke(OrderBuilder $builder, Order $order, User $actor, Cart $cart, array $data)
    {
        $checkoutId = Arr::get($data, 'data.attributes.payWithStripeCheckout');

        if ($checkoutId) {
            $session = \Stripe\Checkout\Session::retrieve($checkoutId);

            if (!$session || $session->payment_status !== 'paid') {
                throw new ValidationException([
                    'payment' => 'Invalid or cancelled Stripe Checkout session',
                ]);
            }

            $builder->addPayment('stripe-session', $session->amount_total, $session->id);
        } else if (Arr::get($data, 'data.attributes.payWithStripe')) {
            $intent = CartUtil::retrieveOrCreatePaymentIntent($cart);

            // TODO: accept "processing" as a valid status?
            if ($intent->status !== 'succeeded' && $intent->status !== 'requires_capture') {
                throw new ValidationException([
                    'payment' => 'Invalid or cancelled Stripe payment intent',
                ]);
            }

            // TODO: flag for required capture
            $builder->addPayment('stripe-payment-intent', $intent->amount, $intent->id);
        }
    }
}
