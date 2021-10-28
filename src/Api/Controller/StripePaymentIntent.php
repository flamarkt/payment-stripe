<?php

namespace Flamarkt\StripePayment\Api\Controller;

use Flamarkt\StripePayment\CartUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class StripePaymentIntent implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $cart = $request->getAttribute('cart');

        if ($cart->price_total <= 0) {
            return new JsonResponse([
                'error' => 'Cart is not billable',
            ], 400);
        }

        $intent = CartUtil::retrieveOrCreatePaymentIntent($cart);

        return new JsonResponse([
            'id' => $intent->id, //TODO: necessary?
            'client_secret' => $intent->client_secret,
        ]);
    }
}
