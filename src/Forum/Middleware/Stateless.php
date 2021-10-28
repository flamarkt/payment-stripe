<?php

namespace Flamarkt\StripePayment\Forum\Middleware;

use Dflydev\FigCookies\FigResponseCookies;
use Flarum\Http\CookieFactory;
use Illuminate\Support\Str;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * This middleware removes the cookies from responses to address https://stackoverflow.com/q/44837450
 * Otherwise when such a page is requested in an iframe, Flarum can't read the existing session, so it generates a new one which overrides the existing one
 */
class Stateless implements MiddlewareInterface
{
    protected $cookie;

    public function __construct(CookieFactory $cookie)
    {
        $this->cookie = $cookie;
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $response = $handler->handle($request);

        if (Str::startsWith($request->getUri()->getPath(), '/flamarkt/stripe-iframe')) {
            return FigResponseCookies::remove($response, $this->cookie->getName('session'));
        }

        return $response;
    }
}
