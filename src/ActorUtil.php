<?php

namespace Flamarkt\StripePayment;

use Flarum\User\User;
use Stripe\Customer;

class ActorUtil
{
    public static function initCustomer(User $user): Customer
    {
        $customer = Customer::create([
            'email' => $user->email,
            'name' => $user->display_name,
            'metadata' => [
                'flarum-id' => $user->id,
            ],
        ]);

        $user->stripe_customer_id = $customer->id;
        $user->save();

        return $customer;
    }

    public static function retrieveOrCreateCustomer(User $user): Customer
    {
        if (!$user->stripe_customer_id) {
            return self::initCustomer($user);
        }

        return Customer::retrieve($user->stripe_customer_id);
    }
}
