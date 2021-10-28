<?php

namespace Flamarkt\StripePayment;

use Flarum\Foundation\AbstractServiceProvider;
use Flarum\Settings\SettingsRepositoryInterface;

class StripeServiceProvider extends AbstractServiceProvider
{
    public function register()
    {
        /**
         * @var SettingsRepositoryInterface $settings
         */
        $settings = $this->container->make(SettingsRepositoryInterface::class);

        \Stripe\Stripe::setApiKey($settings->get('flamarkt-payment-stripe.secretKey'));
    }
}
