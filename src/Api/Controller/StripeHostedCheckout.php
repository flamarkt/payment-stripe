<?php

namespace Flamarkt\StripePayment\Api\Controller;

use Flamarkt\Core\Cart\CartRepository;
use Flamarkt\StripePayment\ActorUtil;
use Flamarkt\StripePayment\CartUtil;
use Flarum\Http\RequestUtil;
use Flarum\Http\UrlGenerator;
use Flarum\Locale\Translator;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Contracts\Session\Session;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class StripeHostedCheckout implements RequestHandlerInterface
{
    public function __construct(
        protected CartRepository              $cartRepository,
        protected UrlGenerator                $url,
        protected Translator                  $translator,
        protected SettingsRepositoryInterface $settings
    )
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (!$this->settings->get('flamarkt-payment-stripe.hostedCheckout')) {
            throw new PermissionDeniedException();
        }

        $actor = RequestUtil::getActor($request);
        $cart = $request->getAttribute('cart');

        // We don't care if there's already a stripe-checkout lock on the cart
        // Stripe will take care of handling any duplicate submission if necessary,
        // and we'll check the state when it comes back from the redirect
        $this->cartRepository->validateAndLockContent($actor, $cart, 'stripe-checkout');

        $session = \Stripe\Checkout\Session::create([
            'customer' => ActorUtil::retrieveOrCreateCustomer($cart->user),
            // TODO: connect method choice to a setting in admin panel
            'payment_method_types' => ['card'],
            'payment_intent_data' => [
                'capture_method' => CartUtil::apiCaptureMethod(),
                'metadata' => CartUtil::apiMetadata($cart),
            ],
            'line_items' => [[
                'price_data' => [
                    'currency' => CartUtil::apiCurrency(),
                    'product_data' => [
                        'name' => $this->translator->trans('flamarkt-payment-stripe.api.hostedCheckout.singleItem'),
                    ],
                    'unit_amount' => CartUtil::apiAmount($cart),
                ],
                'quantity' => 1,
            ]],
            'mode' => 'payment',
            // Same metadata as Payment Intent is intentionally re-used
            'metadata' => CartUtil::apiMetadata($cart),
            'success_url' => $this->url->to('forum')->route('flamarkt.stripe.checkout.success'),
            'cancel_url' => $this->url->to('forum')->route('flamarkt.stripe.checkout.cancel'),
            'locale' => $this->settings->get('flamarkt-payment-stripe.forceLocaleAuto') ? 'auto' : $this->translator->getLocale(),
        ]);

        /**
         * @var Session $requestSession
         */
        $requestSession = $request->getAttribute('session');

        $requestSession->put('stripeSession', $session->id);

        return new JsonResponse([
            'url' => $session->url,
        ]);
    }
}
