import Modal, {IInternalModalAttrs} from 'flarum/common/components/Modal';

interface IframeModalAttrs extends IInternalModalAttrs {
    url: string
}

export default class IframeModal extends Modal<IframeModalAttrs> {
    className(): string {
        return 'FlamarktStripePaymentModal';
    }

    title() {
        return '';
    }

    content() {
        return m('iframe', {
            src: this.attrs.url,
            width: 600,
            height: 400,
        });
    }
}
