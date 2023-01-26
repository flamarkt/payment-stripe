<?php

namespace Flamarkt\StripePayment\Forum\Controller;

use Flamarkt\Core\Cart\CartLock;
use Flarum\Http\RequestUtil;
use Flarum\Http\UrlGenerator;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class StripeCheckoutCancel implements RequestHandlerInterface
{
    public function __construct(
        protected UrlGenerator $url,
        protected CartLock     $lock
    )
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $cart = $request->getAttribute('cart');

        // Release lock so user can modify cart content or use a different payment method
        if (
            RequestUtil::getActor($request)->can('checkout', $cart) &&
            $this->lock->isContentLockedBy($cart, 'stripe-checkout')
        ) {
            $this->lock->unlockContent($cart);
        }

        return new RedirectResponse($this->url->to('forum')->route('flamarkt.cart') . '?continue=stripe-cancelled');
    }
}
