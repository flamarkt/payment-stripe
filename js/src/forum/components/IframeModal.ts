import Modal from 'flarum/common/components/Modal';

export default class IframeModal extends Modal {
    content() {
        return m('iframe', {
            src: this.attrs.url,
            width: 600,
            height: 400,
        });
    }
}
