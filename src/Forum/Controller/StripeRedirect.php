<?php

namespace Flamarkt\StripePayment\Forum\Controller;

use Flamarkt\Core\Cart\CartRepository;
use Flamarkt\Core\Order\Order;
use Flamarkt\Core\Order\OrderBuilderFactory;
use Flamarkt\StripePayment\CartUtil;
use Flarum\Http\RequestUtil;
use Flarum\Http\SlugManager;
use Flarum\Http\UrlGenerator;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class StripeRedirect implements RequestHandlerInterface
{
    protected $url;
    protected $slugManager;
    protected $orderBuilder;

    public function __construct(UrlGenerator $url, SlugManager $slugManager, OrderBuilderFactory $orderBuilder)
    {
        $this->url = $url;
        $this->slugManager = $slugManager;
        $this->orderBuilder = $orderBuilder;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $cart = $request->getAttribute('cart');

        // TODO: CSRF protection

        // If the cart is empty, we won't be able to create/retrieve an intent, so we'll skip
        if ($cart->price_total <= 0) {
            return new RedirectResponse($this->url->to('forum')->route('flamarkt.cart'));
        }

        $intent = CartUtil::retrieveOrCreatePaymentIntent($cart);

        if ($intent->status !== 'succeeded' && $intent->status !== 'requires_capture') {
            return new RedirectResponse($this->url->to('forum')->route('flamarkt.cart') . '?stripe_status=' . $intent->status);
        }

        $order = $this->orderBuilder->build(RequestUtil::getActor($request), $cart, [
            'data' => [
                'attributes' => [
                    'payWithStripe' => true,
                ],
            ],
        ], $request);

        return new RedirectResponse($this->url->to('forum')->route('flamarkt.orders.show', [
            'id' => $this->slugManager->forResource(Order::class)->toSlug($order),
        ]));
    }
}
