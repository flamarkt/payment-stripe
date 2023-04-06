<?php

namespace Flamarkt\StripePayment;

use Flarum\Extend;
use Flarum\Http\Middleware\StartSession;
use Stripe\Exception\ApiErrorException;

return [
    (new Extend\Frontend('backoffice'))
        ->js(__DIR__ . '/js/dist/backoffice.js'),

    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js'),

    new Extend\Locales(__DIR__ . '/resources/locale'),

    (new Extend\Routes('api'))
        ->post('/flamarkt/stripe-capture', 'flamarkt.stripe.capture', Api\Controller\CaptureFundsController::class)
        ->post('/flamarkt/stripe-hosted-checkout', 'flamarkt.stripe.checkout', Api\Controller\StripeHostedCheckout::class)
        ->post('/flamarkt/stripe-payment-intent', 'flamarkt.stripe.payment-intent', Api\Controller\StripePaymentIntent::class),

    (new Extend\Routes('forum'))
        ->get('/flamarkt/stripe-checkout/cancel', 'flamarkt.stripe.checkout.cancel', Forum\Controller\StripeCheckoutCancel::class)
        ->get('/flamarkt/stripe-checkout/success', 'flamarkt.stripe.checkout.success', Forum\Controller\StripeCheckoutSuccess::class)
        ->get('/flamarkt/stripe-redirect', 'flamarkt.stripe.redirect', Forum\Controller\StripeRedirect::class)
        ->get('/flamarkt/stripe-iframe-complete', 'flamarkt.stripe.iframe.complete', Forum\Controller\StripeIframeComplete::class),

    (new Extend\Middleware('forum'))
        ->insertBefore(StartSession::class, Forum\Middleware\Stateless::class),

    (new Extend\Settings())
        ->serializeToForum('flamarktStripePublishableKey', 'flamarkt-payment-stripe.publishableKey')
        ->serializeToForum('flamarktStripeHostedCheckout', 'flamarkt-payment-stripe.hostedCheckout', 'boolval')
        ->serializeToForum('flamarktStripeAlwaysRedirect', 'flamarkt-payment-stripe.alwaysRedirect', 'boolval')
        ->serializeToForum('flamarktStripeCardOnly', 'flamarkt-payment-stripe.cardOnly', 'boolval'),

    (new Extend\ServiceProvider())
        ->register(StripeServiceProvider::class),

    (new Extend\ErrorHandling())
        ->handler(ApiErrorException::class, StripeErrorHandler::class),

    (new \Flamarkt\Core\Extend\Payment)
        ->remainingCallback(Pay::class),
];
