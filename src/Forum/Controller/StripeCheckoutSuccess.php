<?php

namespace Flamarkt\StripePayment\Forum\Controller;

use Flarum\Http\UrlGenerator;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class StripeCheckoutSuccess implements RequestHandlerInterface
{
    public function __construct(
        protected UrlGenerator $url
    )
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        return new RedirectResponse($this->url->to('forum')->route('flamarkt.cart') . '?continue=stripe');
    }
}
