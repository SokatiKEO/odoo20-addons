from odoo import api, fields, models


class PosConfig(models.Model):
    _inherit = "pos.config"

    khr_exchange_rate = fields.Float(
        string="KHR Exchange Rate",
        default=4100.0,
        help="Exchange rate from USD to KHR (e.g. 4100).",
    )
    receipt_header_khmer_company_name = fields.Char(
        string="Receipt Khmer Company Name",
        default="យូ & មី ខហ្វហ្វី ឯ.ក",
        help="Khmer company name displayed at the top of the receipt header.",
    )
    receipt_header_company_name = fields.Char(
        string="Receipt Company Name",
        default="YOU & ME COFFEE CO., LTD",
        help="English company name displayed below the Khmer company name. Defaults to YOU & ME COFFEE CO., LTD.",
    )
    receipt_vat_tin = fields.Char(
        string="Receipt VAT TIN",
        compute="_compute_receipt_vat_tin",
        store=True,
        readonly=False,
        help="VAT/TIN displayed on the receipt. Defaults to company VAT.",
    )
    receipt_address = fields.Char(
        string="Receipt Address",
        compute="_compute_receipt_address",
        store=True,
        readonly=False,
        help="Address displayed on the receipt. Defaults to company address.",
    )
    receipt_phone = fields.Char(
        string="Receipt Phone",
        compute="_compute_receipt_phone",
        store=True,
        readonly=False,
        help="Phone number displayed on the receipt. Defaults to company phone.",
    )
    receipt_footer_khmer_note = fields.Char(
        string="Receipt Khmer Footer Note",
        default="សូមអញ្ជើញមកម្តងទៀត!",
        help="Khmer closing greeting printed at the bottom of the receipt.",
    )
    receipt_footer_note = fields.Char(
        string="Receipt Footer Note",
        default="Thank You so much for your support!",
        help="English closing greeting printed at the bottom of the receipt.",
    )
    receipt_font_size = fields.Integer(
        string="Receipt Font Size (px)",
        default=15,
        help="Base font size in pixels for the receipt (default 15px).",
    )

    @api.depends("company_id.vat")
    def _compute_receipt_vat_tin(self):
        """Default the receipt VAT TIN from the POS company when unset."""
        for config in self:
            if not config.receipt_vat_tin:
                config.receipt_vat_tin = config.company_id.vat or ""

    @api.depends("company_id")
    def _compute_receipt_address(self):
        """Default the receipt address from the POS company when unset."""
        for config in self:
            if not config.receipt_address:
                company = config.company_id
                address = getattr(company, "english_address", False)
                if not address:
                    parts = [
                        p
                        for p in [
                            company.street,
                            company.street2,
                            company.city,
                            company.country_id.name,
                        ]
                        if p
                    ]
                    address = ", ".join(parts) if parts else ""
                config.receipt_address = address or ""

    @api.depends("company_id.phone")
    def _compute_receipt_phone(self):
        """Default the receipt phone from the POS company when unset."""
        for config in self:
            if not config.receipt_phone:
                config.receipt_phone = config.company_id.phone or ""

    @api.model
    def default_get(self, fields_list):
        """Populate company defaults when creating a new POS configuration.

        :param list[str] fields_list: List of field names requested
        :return: Default values dictionary
        :rtype: dict
        """
        res = super().default_get(fields_list)
        company_id = res.get("company_id") or self.env.company.id
        company = self.env["res.company"].browse(company_id)
        if "receipt_header_company_name" in fields_list and not res.get(
            "receipt_header_company_name"
        ):
            res["receipt_header_company_name"] = company.name or ""
        if "receipt_vat_tin" in fields_list and not res.get("receipt_vat_tin"):
            res["receipt_vat_tin"] = company.vat or ""
        if "receipt_address" in fields_list and not res.get("receipt_address"):
            res["receipt_address"] = (
                getattr(company, "english_address", False)
                or ", ".join(
                    [
                        p
                        for p in [
                            company.street,
                            company.street2,
                            company.city,
                            company.country_id.name,
                        ]
                        if p
                    ]
                )
                or ""
            )
        if "receipt_phone" in fields_list and not res.get("receipt_phone"):
            res["receipt_phone"] = company.phone or ""
        return res
