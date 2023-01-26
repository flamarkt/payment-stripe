<?php

namespace Flamarkt\StripePayment\Forum\Middleware;

use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Cache\Repository;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class ApplePay implements MiddlewareInterface
{
    public function __construct(
        protected SettingsRepositoryInterface $settings,
        protected Repository                  $cache
    )
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if (
            $request->getUri()->getPath() === '/.well-known/apple-developer-merchantid-domain-association' &&
            $this->settings->get('flamarkt-payment-stripe.applePayDomainAssociation')
        ) {
            return new TextResponse($this->cache->rememberForever('flamarkt-payment-stripe.applePayWellKnown', function () {
                return file_get_contents('https://stripe.com/files/apple-pay/apple-developer-merchantid-domain-association');
            }));
        }

        return $handler->handle($request);
    }
}
