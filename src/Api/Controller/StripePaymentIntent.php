<?php

namespace Flamarkt\StripePayment\Api\Controller;

use Flamarkt\Core\Cart\CartRepository;
use Flamarkt\StripePayment\CartUtil;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class StripePaymentIntent implements RequestHandlerInterface
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected CartRepository              $cartRepository
    )
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if ($this->settings->get('flamarkt-payment-stripe.hostedCheckout')) {
            throw new PermissionDeniedException();
        }

        $actor = RequestUtil::getActor($request);
        $cart = $request->getAttribute('cart');

        // The cart page will request a payment intent as soon as it loads, so we don't want to lock the cart just yet
        // Once the frontend starts sending the user on a redirect, it will call the endpoint with this attribute to tell us the serious part has begun
        if (Arr::get($request->getParsedBody(), 'commitToOrder')) {
            $this->cartRepository->validateAndLockContent($actor, $cart, 'stripe-intent');
        }

        if ($cart->price_total <= 0) {
            return new JsonResponse([
                // This error shouldn't be visible in regular operation since Stripe wouldn't be offered in the frontend for a cart with nothing to bill
                'error' => 'Cart is not billable',
            ], 400);
        }

        $intent = CartUtil::retrieveOrCreatePaymentIntent($cart, true);

        return new JsonResponse([
            'id' => $intent->id, //TODO: necessary?
            'client_secret' => $intent->client_secret,
        ]);
    }
}
