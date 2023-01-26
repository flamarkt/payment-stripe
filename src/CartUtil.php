<?php

namespace Flamarkt\StripePayment;

use Flamarkt\Core\Cart\Cart;
use Flarum\Foundation\Config;
use Flarum\Foundation\ErrorHandling\Reporter;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Container\Container;
use Stripe\Exception\ApiErrorException;
use Stripe\PaymentIntent;
use Stripe\Refund;

class CartUtil
{
    public static function apiAmount(Cart $cart): int
    {
        // TODO: make configurable
        // Currently frontend is hard-coded to cents the same way as Stripe, so it's fine to pass the raw value
        return $cart->amount_due_after_partial ?? 0;
    }

    public static function apiCurrency(): string
    {
        // TODO: make configurable
        // Currently hard-coded to the same value as the frontend
        return 'chf';
    }

    public static function apiMethodTypes(): array
    {
        // Currently intents are only implemented for cards
        // For other methods, the hosted checkout should be used
        // In the future other methods might be implemented without the hosted checkout
        return ['card'];
    }

    public static function apiCaptureMethod(): string
    {
        // TODO: Support payment_method_options[card][capture_method]=manual in case multiple payment methods are allowed and the option is still used
        if (resolve(SettingsRepositoryInterface::class)->get('flamarkt-payment-stripe.captureLater')) {
            return 'manual';
        }

        return 'automatic';
    }

    public static function apiMetadata(Cart $cart): array
    {
        return [
            'flamarkt-cart-uid' => $cart->uid,
        ];
    }

    public static function initPaymentIntent(Cart $cart): PaymentIntent
    {
        $intent = PaymentIntent::create([
            'amount' => self::apiAmount($cart),
            'currency' => self::apiCurrency(),
            'customer' => ActorUtil::retrieveOrCreateCustomer($cart->user),
            'payment_method_types' => self::apiMethodTypes(),
            'capture_method' => self::apiCaptureMethod(),
            'metadata' => self::apiMetadata($cart),
        ]);

        $cart->stripe_payment_intent_id = $intent->id;
        $cart->save();

        return $intent;
    }

    public static function retrieveOrCreatePaymentIntent(Cart $cart, bool $recreateIfNeeded = false): PaymentIntent
    {
        if (!$cart->stripe_payment_intent_id) {
            return self::initPaymentIntent($cart);
        }

        $intent = PaymentIntent::retrieve($cart->stripe_payment_intent_id);

        if ($recreateIfNeeded && $intent->amount !== self::apiAmount($cart)) {
            // Update amount if it has changed and that the user has not started the payment flow yet
            if ($intent->status === 'requires_payment_method') {
                $intent = PaymentIntent::update($cart->stripe_payment_intent_id, [
                    'amount' => self::apiAmount($cart),
                ]);
            } else if ($intent->status === 'requires_capture' && $intent->amount > self::apiAmount($cart)) {
                // If we are holding more funds than necessary, we don't make the user go through the payment flow again
                // We'll just keep the excess funds until the final capture happens
            } else {
                // If the amount can no longer be changed, it means the user probably submitted the cart,
                // An error occurred after payment was successfully captured, the hold expired and the user modified the cart before trying to checkout again
                // In that case we'll cancel the existing payment and start with a new one.
                if ($intent->status === 'requires_confirmation' || $intent->status === 'requires_capture') {
                    $intent->cancel();
                } else {
                    try {
                        Refund::create([
                            'payment_intent' => $cart->stripe_payment_intent_id,
                            'reason' => 'duplicate',
                            'metadata' => self::apiMetadata($cart),
                        ]);
                    } catch (ApiErrorException $exception) {
                        // Make it easier to troubleshoot in demo mode
                        if (resolve(Config::class)->inDebugMode()) {
                            throw $exception;
                        }

                        // We want to silence the error because it doesn't prevent the process from continuing
                        // However we want to make sure the error is reported since it might require manual refunding
                        $reporters = resolve(Container::class)->tagged(Reporter::class);

                        foreach ($reporters as $reporter) {
                            $reporter->report($exception);
                        }
                    }
                }

                $cart->stripe_payment_intent_id = null;

                return self::retrieveOrCreatePaymentIntent($cart);
            }
        }

        return $intent;
    }
}
