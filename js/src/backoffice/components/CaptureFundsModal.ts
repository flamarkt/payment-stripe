import {Children, Vnode} from 'mithril';
import app from 'flamarkt/backoffice/backoffice/app';
import Modal, {IInternalModalAttrs} from 'flarum/common/components/Modal';
import PriceInput from 'flamarkt/core/common/components/PriceInput';
import PriceLabel from 'flamarkt/core/common/components/PriceLabel';
import Order from 'flamarkt/core/common/models/Order';
import Payment from 'flamarkt/core/common/models/Payment';
import ItemList from 'flarum/common/utils/ItemList';
import Button from 'flarum/common/components/Button';

interface IframeModalAttrs extends IInternalModalAttrs {
    order: Order
    payment: Payment
}

export default class CaptureFundsModal extends Modal<IframeModalAttrs> {
    paidWithOtherMethods!: number
    amountDue!: number
    amount!: number
    saving: boolean = false;

    oninit(vnode: Vnode) {
        super.oninit(vnode);

        const {order} = this.attrs;

        this.paidWithOtherMethods = order.paidAmount() - (this.attrs.payment.amount() || 0);

        this.amountDue = order.priceTotal() - this.paidWithOtherMethods;
        this.amount = this.amountDue;
    }

    className(): string {
        return 'FlamarktStripeCaptureFundsModal';
    }

    title() {
        return 'Capture Funds';
    }

    content() {
        return m('.Modal-body', this.fields().toArray());
    }

    fields(): ItemList<Children> {
        const fields = new ItemList<Children>();

        const {order, payment} = this.attrs;

        fields.add('info', m('.Form-group', [
            m('dl', [
                m('dt', 'Order total'),
                m('dd', PriceLabel.component({
                    value: order.priceTotal(),
                })),
            ]),
            m('dl', [
                m('dt', 'Paid with other methods'),
                m('dd', PriceLabel.component({
                    value: this.paidWithOtherMethods,
                })),
            ]),
            m('dl', [
                m('dt', 'Amount due'),
                m('dd', PriceLabel.component({
                    value: this.amountDue,
                })),
            ]),
            m('dl', [
                m('dt', 'Amount on hold'),
                m('dd', PriceLabel.component({
                    value: payment.amount(),
                })),
            ]),
        ]), 20);

        fields.add('amount', m('.Form-group', [
            m('label', 'Amount'),
            m(PriceInput, {
                value: this.amount,
                onchange: (value: number) => {
                    this.amount = value;
                },
                disabled: this.saving,
            }),
        ]), 10);

        fields.add('submit', m('.Form-group', [
            Button.component({
                type: 'submit',
                className: 'Button Button--primary',
                loading: this.saving,
            }, 'Confirm'),
        ]), -10);

        return fields;
    }

    onsubmit(event: Event) {
        event.preventDefault();

        this.saving = true;

        app.request({
            method: 'POST',
            url: app.forum.attribute('apiUrl') + '/flamarkt/stripe-capture',
            body: {
                paymentIntentId: this.attrs.payment.identifier(),
                amount: this.amount,
            },
            errorHandler: this.onerror.bind(this),
        }).then(() => {
            this.hide();
            app.alerts.show({
                type: 'success',
            }, 'Funds captured. Refresh page to see.');
        }).catch(error => {
            this.saving = false;
            m.redraw();
            throw error;
        });
    }
}
