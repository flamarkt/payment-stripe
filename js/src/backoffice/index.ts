import app from 'flamarkt/backoffice/backoffice/app';
import {extend} from 'flarum/common/extend';
import PaymentList from 'flamarkt/core/backoffice/components/PaymentList';
import Order from 'flamarkt/core/common/models/Order';
import Button from 'flarum/common/components/Button';

app.initializers.add('flamarkt-payment-stripe', () => {
    app.extensionData.for('flamarkt-payment-stripe')
        .registerSetting({
            type: 'text',
            setting: 'flamarkt-payment-stripe.secretKey',
            label: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.secretKey'),
        })
        .registerSetting({
            type: 'text',
            setting: 'flamarkt-payment-stripe.publishableKey',
            label: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.publishableKey'),
        })
        .registerSetting({
            type: 'switch',
            setting: 'flamarkt-payment-stripe.hostedCheckout',
            label: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.hostedCheckout'),
            help: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.hostedCheckoutHelp'),
        })
        .registerSetting({
            type: 'switch',
            setting: 'flamarkt-payment-stripe.alwaysRedirect',
            label: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.alwaysRedirect'),
            help: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.alwaysRedirectHelp'),
        })
        .registerSetting({
            type: 'switch',
            setting: 'flamarkt-payment-stripe.cardOnly',
            label: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.cardOnly'),
            help: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.cardOnlyHelp'),
        })
        .registerSetting({
            type: 'switch',
            setting: 'flamarkt-payment-stripe.captureLater',
            label: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.captureLater'),
            help: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.captureLaterHelp'),
        })
        .registerSetting({
            type: 'switch',
            setting: 'flamarkt-payment-stripe.forceLocaleAuto',
            label: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.forceLocaleAuto'),
            help: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.forceLocaleAutoHelp'),
        })
        .registerSetting({
            type: 'switch',
            setting: 'flamarkt-payment-stripe.applePayDomainAssociation',
            label: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.applePayDomainAssociation'),
            help: app.translator.trans('flamarkt-payment-stripe.backoffice.settings.applePayDomainAssociationHelp'),
        });

    extend(PaymentList.prototype, 'actions', function (items, payment) {
        if (payment.method() === 'stripe-intent-hold') {
            items.add('stripe-capture', Button.component({
                icon: 'fas fa-credit-card',
                className: 'Button',
                onclick() {
                    const order = app.store.all<Order>('flamarkt-orders').find(order => {
                        return (order.payments() || []).some(p => p === payment);
                    });

                    if (!order) {
                        // Shouldn't happen since the payment is loaded through an order relationship in the first place
                        console.error('Could not find order payment belongs to');
                        return;
                    }

                    const factor = Math.pow(10, app.forum.attribute('priceDecimals'));

                    // TODO: use modal with price input
                    const userAmount = prompt('Amount to capture', order.priceTotal() / factor);

                    if (userAmount === '' || userAmount === null) {
                        return;
                    }

                    app.request({
                        method: 'POST',
                        url: app.forum.attribute('apiUrl') + '/flamarkt/stripe-capture',
                        body: {
                            paymentIntentId: payment.identifier(),
                            amount: Math.round(userAmount * factor),
                        },
                    }).then(() => {
                        app.alerts.show({
                            type: 'success',
                        }, 'Funds captured. Refresh page to see.');
                    });
                },
            }, 'Capture funds'));
        }
    });
});
