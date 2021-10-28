<?php

namespace Flamarkt\StripePayment\Forum\Controller;

use Laminas\Diactoros\Response\HtmlResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class StripeIframeComplete implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        return new HtmlResponse("<p>This modal should now close automatically.</p><script>window.top.postMessage('3DS-authentication-complete');</script>");
    }
}
