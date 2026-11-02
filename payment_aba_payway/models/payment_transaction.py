from datetime import datetime
import pprint
from urllib.parse import urljoin
import logging

from odoo import _, api, models
from odoo.addons.payment import utils as payment_utils
from odoo.tools import float_compare, float_round
from odoo.exceptions import ValidationError

from odoo.addons.payment_aba_payway import const
from odoo.addons.payment_aba_payway import utils as payway_utils

_logger = logging.getLogger(__name__)

class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    def _get_status_message(self, **kwargs):
        self.ensure_one()
        if self.provider_code == 'aba_payway' and self.state == 'draft':
            return _("Your payment is being processed. Please do not refresh or close your browser.")
        return super()._get_status_message(**kwargs)

    @api.model
    def _compute_reference(self, provider_code, prefix=None, separator='-', **kwargs):
        """Override of `payment` to ensure that PayWay requirement for references is satisfied.

        PayWay requires for references to be at most 20 characters long.
        Make sure that on DB change, the PayWay transaction id will not be duplicate.
        Preserve Odoo original reference in PayWay transaction id for easy reconciliation.

        :param str provider_code: The code of the provider handling the transaction.
        :param str prefix: The custom prefix used to compute the full reference.
        :param str separator: The custom separator used to separate the prefix from the suffix.
        :param dict kwargs: Optional values passed to `_compute_reference_prefix`.
        :return: The unique reference for the transaction.
        :rtype: str
        """
        if provider_code != 'aba_payway':
            return super()._compute_reference(provider_code, prefix=prefix, separator=separator, **kwargs)

        if not prefix:
            prefix = self.sudo()._compute_reference_prefix(separator, **kwargs)
        if not prefix:
            prefix = payment_utils.singularize_reference_prefix()

        prefix = payway_utils._compute_payway_tran_id(prefix=prefix, separator=separator)

        return super()._compute_reference(provider_code, prefix=prefix, separator=separator, **kwargs)

    def _get_specific_rendering_values(self, processing_values):
        """Override of payment to return ABA Payway specific rendering values.

        Note: self.ensure_one() from `_get_processing_values`

        :param dict processing_values: The generic processing values of the transaction.
        :return: The dict of provider-specific rendering values.
        :rtype: dict
        """
        res = super()._get_specific_rendering_values(processing_values)
        if self.provider_code != 'aba_payway':
            return res

        api_url, merchant_id, api_key, _ = self.provider_id._payway_get_api_cred()

        req_time = datetime.now().strftime('%Y%m%d%H%M%S')
        partner_first_name, partner_last_name = (
            payment_utils.split_partner_name(self.partner_name) 
            if self.partner_name 
            else (None, None)
        )
        payment_option = const.PAYMENT_METHODS_MAPPING.get(
            self.payment_method_id.code, 'cards'
        )

        # The amount is explicitly converted to a string to prevent a hash mismatch.
        # This avoids issues where JavaScript drops trailing zeros from numbers (e.g., 23.0 becomes 23),
        rounded_amount = str(
            float_round(
                processing_values.get('amount'),
                const.CURRENCY_DECIMALS.get(self.currency_id.name, 2),
                rounding_method='DOWN',
            )
        )

        base_odoo_url = self.get_base_url()

        webhook_url = urljoin(
            (
                base_odoo_url.replace('http://', 'https://', 1)
                if base_odoo_url and base_odoo_url.startswith('http://')
                else base_odoo_url
            ),
            const.WEB_HOOK_PATH['webhook'],
        )

        url_params = {
            'req_time': req_time,
            'merchant_id': merchant_id,
            'tran_id': self.reference,
            'amount': rounded_amount,
            'firstname': partner_first_name and partner_first_name[:20] or '',
            'lastname': partner_last_name and partner_last_name[:20] or '',
            'email': (
                self.partner_email
                if self.partner_email and len(self.partner_email) <= 50
                else ''
            ),
            'phone': self.partner_phone and self.partner_phone[:20] or '',
            'type': 'pre-auth' if self.provider_id.capture_manually else 'purchase',
            'payment_option': payment_option,
            'return_url': webhook_url,
            'continue_success_url': urljoin(base_odoo_url, '/payment/status'),
            'currency': self.currency_id.name,
            'lifetime': 3,
            'skip_success_page': 1,
            'payment_gate': '0',
        }

        url_params['hash'] = self.provider_id._payway_calculate_payment_secure_hash(
            api_key, url_params, const.PURCHASE_PAYMENT_SECURE_HASH_KEYS
        )

        return {
            'api_url': urljoin(api_url, '/api/payment-gateway/v1/payments/purchase'),
            'url_params': url_params,
        }
    
    def _send_refund_request(self):
        """Override of `payment` to send a refund request to PayWay."""
        if self.provider_code != 'aba_payway':
            return super()._send_refund_request()

        _, merchant_id, _, public_key_pem = self.provider_id._payway_get_api_cred()
        payload_merchant_auth = {
            "mc_id": merchant_id,
            "tran_id": self.source_transaction_id.provider_reference or self.source_transaction_id.reference,
            "refund_amount": -self.amount,
        }
        merchant_auth = self.provider_id._payway_calculate_merchant_auth(public_key_pem, payload_merchant_auth)

        data: dict = self.provider_id._payway_api_refund_transaction(merchant_auth)
        _logger.info(
            "Payway refund request response for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(data)
        )

        data.update({
            'tran_id': self.reference,
            'payment_status': const.STATUS_MAPPING['REFUNDED'],
        })
        self._record(data)

    def _send_capture_request(self):
        """Override of `payment` to send a capture request to PayWay."""
        if self.provider_code != 'aba_payway':
            return super()._send_capture_request()

        _, merchant_id, _, public_key_pem = self.provider_id._payway_get_api_cred()
        payload_merchant_auth = {
            "mc_id": merchant_id,
            "tran_id": self.source_transaction_id.provider_reference or self.source_transaction_id.reference,
            "complete_amount": self.amount,
        }
        merchant_auth = self.provider_id._payway_calculate_merchant_auth(public_key_pem, payload_merchant_auth)

        data: dict = self.provider_id._payway_api_capture_transaction(merchant_auth)
        _logger.info(
            "Payway capture request response for transaction with reference %s:\n%s",
            self.reference, pprint.pformat(data)
        )

        data.update({
            'tran_id': self.reference,
            'payment_status': const.STATUS_MAPPING['APPROVED'],
        })
        self.source_transaction_id._set_done()
        self._record(data)

    def _send_void_request(self):
        """Override of `payment` to send a void request to PayWay."""
        if self.provider_code != 'aba_payway':
            return super()._send_void_request()

        if self.source_transaction_id.state != "done":
            _, merchant_id, _, public_key_pem = self.provider_id._payway_get_api_cred()
            payload_merchant_auth = {
                "mc_id": merchant_id,
                "tran_id": self.source_transaction_id.provider_reference or self.source_transaction_id.reference,
            }
            merchant_auth = self.provider_id._payway_calculate_merchant_auth(public_key_pem, payload_merchant_auth)
            data: dict = self.provider_id._payway_api_void_transaction(merchant_auth)
            _logger.info(
                "Payway cancel request response for transaction with reference %s:\n%s",
                self.reference, pprint.pformat(data)
            )
            data.update({
                'tran_id': self.reference,
                'payment_status': const.STATUS_MAPPING['CANCELLED'],
            })
        else:
            data = {
                'payment_status': const.STATUS_MAPPING['CANCELLED'],
                'tran_id': self.reference,
            }
            _logger.info(
                "Payway transaction with reference %s already in 'Done' state, skipping void API call.",
                self.reference,
            )

        self._record(data)

    @api.model
    def _extract_reference(self, provider_code, payment_data):
        """Override of `payment` to extract the reference from the PayWay data."""
        if provider_code != 'aba_payway':
            return super()._extract_reference(provider_code, payment_data)
        return payment_data.get('tran_id') or payment_data.get('reference')

    def _apply_updates(self, payment_data):
        """Override of `payment` to update the transaction based on the PayWay data."""
        self.ensure_one()
        if self.provider_code != 'aba_payway':
            return super()._apply_updates(payment_data)

        self = self.with_context(payment_safe_write=True)
        tran_id = payment_data.get('tran_id') or self.reference
        is_from_webhook = self.env.context.get('payway_from_webhook', False)
        upstream_payment_status = payment_data.get('payment_status', '').upper()

        self.provider_reference = tran_id

        try:
            payway_transaction_detail = self.provider_id._payway_api_get_transaction_detail(tran_id)
        except ValidationError as e:
            _logger.warning(
                "Failed to fetch payment details for reference %s; error: %s",
                self.reference, str(e)
            )
            return

        api_payment_status = payway_transaction_detail.get('data', {}).get('payment_status', '').upper()
        payment_status = (
            api_payment_status
            if is_from_webhook
            else (
                upstream_payment_status
                if upstream_payment_status == const.STATUS_MAPPING['CANCELLED']
                else api_payment_status
            )
        )

        is_valid_settlement, settlement_validation_message = self._payway_validate_transaction_detail(
            payway_transaction_detail,
            payment_status,
        )
        if not is_valid_settlement:
            _logger.warning(
                "PayWay settlement validation failed for transaction %s: %s",
                self.reference, settlement_validation_message
            )
            self._set_pending(state_message=settlement_validation_message)
            return

        if (
            payment_status in (const.STATUS_MAPPING['APPROVED'], const.STATUS_MAPPING['PRE-AUTH'])
            and self.state not in ('done', 'authorized')
        ):
            if self.payment_method_id.code == 'card':
                payment_method_type = payway_transaction_detail.get('data', {}).get('payment_type', '').lower()
                payment_method = self.env['payment.method']._get_from_code(
                    payment_method_type, mapping=const.PAYWAY_PAYMENT_METHODS_MAPPING
                )
                self.payment_method_id = payment_method or self.payment_method_id

        if payment_status in (const.STATUS_MAPPING['APPROVED'], const.STATUS_MAPPING['REFUNDED']):
            self._set_done()
        elif payment_status == const.STATUS_MAPPING['PRE-AUTH']:
            self._set_authorized()
        elif payment_status == const.STATUS_MAPPING['CANCELLED']:
            self._set_canceled()
        else:
            _logger.warning(
                "Received data with invalid payment status: (%s) for transaction with reference %s",
                payment_status, self.reference
            )
            self._set_pending(state_message=self.env._(
                "Received unknown payment status: %(status)s", status=payment_status
            ))

    def _extract_amount_data(self, payment_data):
        """Override of `payment` to skip generic amount validation for ABA PayWay.

        Amount and currency validation is already verified via `_payway_validate_transaction_detail`
        using the transaction detail queried directly from PayWay API.
        """
        if self.provider_code != 'aba_payway':
            return super()._extract_amount_data(payment_data)
        return None

    # === Custom validation methods ===
    def _payway_validate_transaction_detail(self, payway_transaction_detail, payment_status):
        """Validate PayWay amount/currency against the Odoo transaction.

        The validation is enforced only for statuses that can complete/authorize a payment.
        """
        self.ensure_one()

        detail_data = payway_transaction_detail.get('data', {})
        if payment_status not in (
            const.STATUS_MAPPING['APPROVED'],
            const.STATUS_MAPPING['PRE-AUTH'],
        ):
            return True, None

        expected_currency = (self.currency_id.name or '').upper()
        payway_currency = str(detail_data.get('original_currency') or '').upper().strip()

        if not payway_currency or payway_currency != expected_currency:
            return False, _(
                "Payment validation failed: currency mismatch (expected %(expected)s, got %(actual)s).",
                expected=expected_currency,
                actual=payway_currency or 'N/A',
            )

        expected_precision = const.CURRENCY_DECIMALS.get(payway_currency, self.currency_id.decimal_places)
        expected_amount = float_round(
            self.amount,
            precision_digits=expected_precision,
            rounding_method='DOWN',
        )

        raw_payway_amount = detail_data.get('original_amount')
        if raw_payway_amount is None:
            return False, _(
                "Payment validation failed: gateway amount is missing."
            )
        try:
            payway_amount = float(raw_payway_amount)
        except (ValueError, TypeError):
            return False, _(
                "Payment validation failed: gateway amount is invalid."
            )

        amount_matches = (
            float_compare(
                expected_amount,
                payway_amount,
                precision_digits=expected_precision,
            )
            == 0
        )
        if not amount_matches:
            return False, _(
                "Payment validation failed: amount mismatch (expected %(expected_amount)s %(currency)s, got %(actual_amount)s %(actual_currency)s).",
                expected_amount=expected_amount,
                currency=expected_currency,
                actual_amount=payway_amount,
                actual_currency=payway_currency,
            )

        return True, None