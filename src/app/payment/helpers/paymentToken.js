import { wait } from '../../../helpers/promiseHelper';
import { PAYMENT_TOKEN_STATUS } from '../../constants';

const {
    STATUS_PENDING,
    STATUS_CHARGEABLE,
    STATUS_FAILED,
    STATUS_CONSUMED,
    STATUS_NOT_SUPPORTED
} = PAYMENT_TOKEN_STATUS;

const DELAY_PULLING = 5000;
const DELAY_LISTENING = 1000;

const pull = async ({ timer = 0, Token, paymentApi }) => {
    if (timer > DELAY_PULLING * 30) {
        throw new Error('Payment process cancelled');
    }

    const { Status } = await paymentApi.getTokenStatus(Token);

    if (Status === STATUS_FAILED) {
        throw new Error('Payment process failed');
    }

    if (Status === STATUS_CONSUMED) {
        throw new Error('Payment process consumed');
    }

    if (Status === STATUS_NOT_SUPPORTED) {
        throw new Error('Payment process not supported');
    }

    if (Status === STATUS_CHARGEABLE) {
        return;
    }

    if (Status === STATUS_PENDING) {
        await wait(DELAY_PULLING);
        return pull({ Token, paymentApi, timer: timer + DELAY_PULLING });
    }

    throw new Error('Unknown payment token status');
};

export const process = ({ Token, paymentApi, tab }) => {
    return new Promise((resolve, reject) => {
        let listen = false;

        const reset = () => {
            listen = false;
            window.removeEventListener('message', onMessage, false);
            tab.close();
        };

        const listenTab = async () => {
            if (!listen) {
                return;
            }

            if (tab.closed) {
                reject(new Error('Tab closed'));
            }

            await wait(DELAY_LISTENING);
            return listenTab(tab);
        };

        function onMessage(event) {
            const origin = event.origin || event.originalEvent.origin; // For Chrome, the origin property is in the event.originalEvent object.

            if (origin !== 'https://secure.protonmail.com') {
                return;
            }

            if (event.source !== tab) {
                return;
            }

            reset();

            const { cancel } = event.data;

            if (cancel === '1') {
                return reject();
            }

            pull({ Token, paymentApi })
                .then(resolve)
                .catch(reject);
        }

        window.addEventListener('message', onMessage, false);
        listen = true;
        listenTab();
    });
};

export const toParams = (params, Token) => {
    return {
        ...params,
        Payment: {
            Type: 'token',
            Details: {
                Token
            }
        }
    };
};

export const handlePaymentToken = async ({ params, paymentApi, paymentVerificationModal }) => {
    const { Payment, Amount, Currency, PaymentMethodID } = params;
    const { Type } = Payment || {};

    if (['cash', 'bitcoin', 'token'].includes(Type)) {
        return params;
    }

    const { Token, Status, ApprovalURL } = await paymentApi.createToken({ Payment, Amount, Currency, PaymentMethodID });

    if (Status === STATUS_CHARGEABLE) {
        return toParams(params, Token);
    }

    return new Promise((resolve, reject) => {
        paymentVerificationModal.activate({
            params: {
                body: params,
                url: ApprovalURL,
                token: Token,
                onSubmit(data) {
                    paymentVerificationModal.deactivate();
                    resolve(data);
                },
                onClose(error) {
                    paymentVerificationModal.deactivate();
                    reject(error);
                }
            }
        });
    });
};
