<?php

namespace Flamarkt\StripePayment;

use Flamarkt\Core\Cart\Cart;
use Stripe\PaymentIntent;

class CartUtil
{
    public static function initPaymentIntent(Cart $cart): PaymentIntent
    {
        $intent = PaymentIntent::create([
            'amount' => $cart->price_total,
            'currency' => 'chf',
            'customer' => ActorUtil::retrieveOrCreateCustomer($cart->user),
            'payment_method_types' => ['card'],
            'metadata' => [
                'flamarkt-cart-uid' => $cart->uid,
            ],
        ]);

        $cart->stripe_payment_intent_id = $intent->id;
        $cart->save();

        return $intent;
    }

    public static function retrieveOrCreatePaymentIntent(Cart $cart): PaymentIntent
    {
        if (!$cart->stripe_payment_intent_id) {
            return self::initPaymentIntent($cart);
        }

        //TODO: if amount of existing intent is different from new price_total

        return PaymentIntent::retrieve($cart->stripe_payment_intent_id);
    }
}
