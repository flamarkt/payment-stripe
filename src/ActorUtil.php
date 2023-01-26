<?php

namespace Flamarkt\StripePayment;

use Flarum\User\User;
use Stripe\Customer;

class ActorUtil
{
    public static function apiEmail(User $user): string
    {
        return $user->email;
    }

    public static function apiName(User $user): string
    {
        return $user->display_name;
    }

    public static function apiMetadata(User $user): array
    {
        return [
            'flarum-id' => $user->id,
        ];
    }

    public static function initCustomer(User $user): Customer
    {
        // At the moment this should never happen since an unconfirmed user cannot initiate a checkout
        if (!$user->is_email_confirmed) {
            throw new \Exception('User email is not confirmed: #' . $user->id);
        }

        $customer = Customer::create([
            'email' => self::apiEmail($user),
            'name' => self::apiName($user),
            'metadata' => self::apiMetadata($user),
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

        $customer = Customer::retrieve($user->stripe_customer_id);

        if ($customer->email !== self::apiEmail($user) || $customer->name !== self::apiName($user)) {
            $customer = Customer::update($user->stripe_customer_id, [
                'email' => self::apiEmail($user),
                'name' => self::apiName($user),
            ]);
        }

        return $customer;
    }
}
