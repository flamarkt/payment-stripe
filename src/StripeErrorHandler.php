<?php

namespace Flamarkt\StripePayment;

use Flarum\Foundation\ErrorHandling\HandledError;
use Stripe\Exception\ApiErrorException;

class StripeErrorHandler
{
    public function handle(ApiErrorException $exception): ?HandledError
    {
        if ($exception->getHttpStatus() === 404) {
            // Re-use same format as validation errors so they will automatically be shown to the user in the same way
            // Those errors should generally not occur if the frontend refreshes the information before submitting
            // TODO: customize error according to Stripe endpoint that threw a 404
            return (new HandledError($exception, 'validation_error', 422))
                ->withDetails([
                    [
                        'detail' => 'Stripe record not found',
                        'source' => ['pointer' => '/data/attributes/stripe'],
                    ],
                ]);
        }

        // Let other errors be logged as 500/unknown errors
        return null;
    }
}
