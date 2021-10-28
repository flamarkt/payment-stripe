<?php

namespace Flamarkt\StripePayment\Forum\Controller;

use Flarum\Http\UrlGenerator;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class StripeCheckoutCancel implements RequestHandlerInterface
{
    protected $url;

    public function __construct(UrlGenerator $url)
    {
        $this->url = $url;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        // TODO: parameter to show a custom error on the cart page
        return new RedirectResponse($this->url->to('forum')->route('flamarkt.cart'));
    }
}
