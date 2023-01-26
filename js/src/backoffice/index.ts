import app from 'flamarkt/backoffice/backoffice/app';

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
});
