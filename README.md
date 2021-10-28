# Stripe Payment

Stripe payment method.

This extension will receive some more radical changes in the future.

Currently, the money is captured prior to order creation, which can cause situations where money has been captured but no order has been created.

Card-only mode was created with the intent of having a custom 3DS confirmation modal, but that's in fact not really needed since Stripe.js has its own modal that works with the payment element.

Depending on the Stripe payment method, ordre creation might happen through normal API submission or through a redirect.
When using a redirect, other extensions will not work (for instance, using balance payment together with Stripe).

Checkout mode is experimental, currently a single product is added with the amount corresponding to the order, but it's planned to make it work with the actual product list synced to Stripe.

There is still some CSRF protection missing at this time for the redirect-based solutions.
Nothing too dangerous but an external website could mess up existing payment intents and prevent a checkout from completing successfully.

Payment mehtod is currently hard-coded to cards but all Stripe payment methods should work in the future.
