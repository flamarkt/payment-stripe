<?php

namespace Flamarkt\StripePayment\Forum\Controller;

use Flamarkt\Core\Cart\CartRepository;
use Flamarkt\Core\Order\Order;
use Flamarkt\Core\Order\OrderBuilderFactory;
use Flamarkt\Core\Order\OrderRepository;
use Flarum\Http\RequestUtil;
use Flarum\Http\SlugManager;
use Flarum\Http\UrlGenerator;
use Illuminate\Contracts\Session\Session;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class StripeCheckoutSuccess implements RequestHandlerInterface
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

        /**
         * @var Session $requestSession
         */
        $requestSession = $request->getAttribute('session');

        $order = $this->orderBuilder->build(RequestUtil::getActor($request), $cart, [
            'data' => [
                'attributes' => [
                    'payWithStripeCheckout' => $requestSession->get('stripeSession'),
                ],
            ],
        ], $request);

        return new RedirectResponse($this->url->to('forum')->route('flamarkt.orders.show', [
            'id' => $this->slugManager->forResource(Order::class)->toSlug($order),
        ]));
    }
}
