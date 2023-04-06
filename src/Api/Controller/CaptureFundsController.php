<?php

namespace Flamarkt\StripePayment\Api\Controller;

use Flamarkt\Core\Payment\Payment;
use Flarum\Foundation\ValidationException;
use Flarum\Http\RequestUtil;
use Illuminate\Contracts\Validation\Factory;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;
use Stripe\Exception\ApiErrorException;
use Stripe\PaymentIntent;

class CaptureFundsController implements RequestHandlerInterface
{
    public function __construct(
        protected Factory         $validation,
        protected LoggerInterface $logger
    )
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertCan('backoffice');
        $data = (array)$request->getParsedBody();

        $intent = PaymentIntent::retrieve(Arr::get($data, 'paymentIntentId'));

        if ($intent->status !== 'requires_capture') {
            // In case there was previously an error, use this opportunity to fix the information
            $this->updateOrder($intent);

            if ($intent->status === 'succeeded') {
                throw new ValidationException([
                    'payment' => 'Payment Intent was already successfully captured',
                ]);
            }

            throw new ValidationException([
                'payment' => 'Payment Intent cannot be captured. Status: ' . $intent->status,
            ]);
        }

        $this->validation->make($data, [
            'amount' => 'required|integer|min:0|max:' . $intent->amount_capturable,
        ])->validate();

        try {
            $intent = $intent->capture([
                'amount_to_capture' => (int)Arr::get($data, 'amount'),
            ]);
        } catch (ApiErrorException $exception) {
            throw new ValidationException([
                'payment' => 'There was an error capturing the funds: ' . $exception->getMessage(),
            ]);
        }

        $this->updateOrder($intent);

        if ($intent->status !== 'succeeded') {
            throw new ValidationException([
                'payment' => 'There was an error capturing the funds: ' . $intent->status,
            ]);
        }

        return new JsonResponse([
            'success' => true,
        ]);
    }

    protected function updateOrder(PaymentIntent $intent): void
    {
        // There shouldn't be more than one of each entry, and they should all belong to the same order, but we'll handle every possible situation gracefully
        $payments = Payment::query()->whereIn('method', [
            'stripe-intent',
            'stripe-intent-hold',
            'stripe-intent-hold-release',
        ])->where('identifier', $intent->id)->get()->groupBy('method');

        /**
         * @var Payment $originalHold
         */
        $originalHold = optional($payments->get('stripe-intent-hold'))->first();

        // If there was no hold in the first place, the Intent was probably not for a capture but a regular payment
        if (!$originalHold) {
            return;
        }

        // Whether it was successful or can no longer be captured, we have to mark the hold release
        // Whenever this code executes status should be different from requires_capture, but we never know 100%
        // what might be returned by the API after capturing without HTTP error
        if ($intent->status !== 'requires_capture' && !$payments->has('stripe-intent-hold-release')) {
            $releasePayment = new Payment();
            $releasePayment->method = 'stripe-intent-hold-release';
            $releasePayment->identifier = $intent->id;
            // Cancel out whatever was marked as hold in the first place
            $releasePayment->amount = $originalHold->amount * -1;

            $originalHold->order->payments()->save($releasePayment);
        }

        // Only if it was successful, mark as paid
        if ($intent->status === 'succeeded') {
            $existingSuccess = optional($payments->get('stripe-intent'))->first();

            if (!$existingSuccess) {
                $actualPayment = new Payment();
                $actualPayment->method = 'stripe-intent';
                $actualPayment->identifier = $intent->id;
                // Cancel out whatever was marked as hold in the first place
                $actualPayment->amount = $intent->amount_received;

                $originalHold->order->payments()->save($actualPayment);
            } else if ($existingSuccess->amount !== $intent->amount_received) {
                $this->logger->warning('[Stripe Capture Funds] Capture was already marked successful but with a different amount. Already recorded: ' . $existingSuccess->amount . '. New value ' . $intent->amount_received . '. New value will not be saved.');
            }
        }

        $originalHold->order->updateMeta()->save();
    }
}
