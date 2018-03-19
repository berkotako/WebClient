import { INVITE_MAIL } from '../../constants';

/* @ngInject */
function humanVerification(AppModel, User, $state, signupModel, networkActivityTracker, dispatchers) {
    const SELECTOR = {
        FORM_EMAIL: '.humanVerification-formEmail-container',
        FORM_SMS: '.humanVerification-formSms-container',
        BTN_COMPLETE_SETUP: '.humanVerification-completeSetup-create'
    };

    /**
     * Build Destination object config,
     * - type: email => Address
     * - type: sms => Phone
     * @param  {String} type
     * @param  {String} value
     * @return {Object}
     */
    const getDestination = (type, value) => {
        const key = type === 'sms' ? 'Phone' : 'Address';
        return { [key]: value };
    };

    const sendVerificationCode = (Type = '', value = '') => {
        const promise = User.code({
            Username: signupModel.get('username'),
            Type,
            Destination: getDestination(Type, value)
        }).then(({ data = {} } = {}) => data.Code === 1000);
        networkActivityTracker.track(promise);
        return promise;
    };

    const getVerificator = (scope) => {
        if (scope.showCaptcha) {
            return 'captcha';
        }
        if (scope.showEmail) {
            return 'email';
        }
        if (scope.showSms) {
            return 'sms';
        }
    };

    return {
        replace: true,
        scope: {
            model: '='
        },
        templateUrl: require('../../../templates/user/humanVerification.tpl.html'),
        link(scope, el, { offerType = INVITE_MAIL }) {
            const { on, unsubscribe, dispatcher } = dispatchers(['payments']);

            const dispatchHelper = (type, data) => dispatcher.payments(type, data);

            const $formSMS = el.find(SELECTOR.FORM_SMS);
            const $formEMAIL = el.find(SELECTOR.FORM_EMAIL);
            const $btnSetup = el.find(SELECTOR.BTN_COMPLETE_SETUP);

            signupModel.getOptionsVerification(offerType).then(({ email, captcha, sms, payment }) => {
                scope.$applyAsync(() => {
                    scope.showEmail = email;
                    scope.showCaptcha = captcha;
                    scope.showSms = sms;
                    scope.showPayment = payment;
                    scope.verificator = getVerificator(scope);
                });
            });

            /**
             * @TODO RFR each form => component + model and remove facepalm boolean
             */
            const onSubmitSMS = (e) => {
                e.stopPropagation();
                e.preventDefault();
                scope.$applyAsync(() => (scope.smsSending = true));
                sendVerificationCode('sms', scope.model.smsVerification).then((test = false) => {
                    signupModel.set('smsVerificationSent', test);
                    signupModel.set('verificationSent', false);
                    scope.model.smsVerificationSent = test;
                    scope.model.verificationSent = false;
                    scope.smsSending = false;
                });
            };

            const onSubmitEmail = (e) => {
                e.stopPropagation();
                e.preventDefault();
                sendVerificationCode('email', scope.model.emailVerification).then((test = false) => {
                    scope.model.verificationSent = test;
                    scope.model.smsVerificationSent = false;
                    signupModel.set('smsVerificationSent', false);
                    signupModel.set('verificationSent', test);
                });
            };

            const onClickCompleteSetup = (e) => {
                e.preventDefault();
                dispatchHelper('create.account');
            };

            on('payments', (e, { type, data = {} }) => {
                if (type === 'donate.submit' && data.action === 'humanVerification') {
                    dispatchHelper('create.account', data);
                }
            });

            on('humanVerification', (e, { type, data = {} }) => {
                if (type !== 'captcha') {
                    return;
                }
                scope.$applyAsync(() => {
                    scope.model.captcha_token = data.token;
                });
            });

            $btnSetup.on('click', onClickCompleteSetup);
            $formSMS.on('submit', onSubmitSMS);
            $formEMAIL.on('submit', onSubmitEmail);

            scope.$on('$destroy', () => {
                $btnSetup.off('click', onClickCompleteSetup);
                $formSMS.off('submit', onSubmitSMS);
                $formEMAIL.off('submit', onSubmitEmail);
                unsubscribe();
            });
        }
    };
}
export default humanVerification;
