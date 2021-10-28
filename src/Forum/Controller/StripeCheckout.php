<?php

namespace Flamarkt\StripePayment\Forum\Controller;

use Flamarkt\StripePayment\ActorUtil;
use Flarum\Http\RequestUtil;
use Flarum\Http\UrlGenerator;
use Illuminate\Contracts\Session\Session;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class StripeCheckout implements RequestHandlerInterface
{
    protected $url;

    public function __construct(UrlGenerator $url)
    {
        $this->url = $url;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $cart = $request->getAttribute('cart');

        $actor = RequestUtil::getActor($request);

        $session = \Stripe\Checkout\Session::create([
            'customer' => ActorUtil::retrieveOrCreateCustomer($cart->user),
            'payment_method_types' => ['card'],
            'line_items' => [[
                'price_data' => [
                    'currency' => 'chf',
                    'product_data' => [
                        'name' => 'Flamarkt Order',
                    ],
                    'unit_amount' => $cart->price_total,
                ],
                'quantity' => 1,
            ]],
            'mode' => 'payment',
            'metadata' => [
                'flamarkt-cart-uid' => $cart->uid,
            ],
            'success_url' => $this->url->to('forum')->route('flamarkt.stripe.checkout.success'),
            'cancel_url' => $this->url->to('forum')->route('flamarkt.stripe.checkout.cancel'),
        ]);

        /**
         * @var Session $requestSession
         */
        $requestSession = $request->getAttribute('session');

        $requestSession->put('stripeSession', $session->id);

        return new RedirectResponse($session->url);
    }
}
