# -*- coding: utf-8 -*-
from odoo import api, fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    default_partner_id = fields.Many2one(
        'res.partner',
        string="Default POS Customer",
        help="Default customer selected for new orders in this Point of Sale.",
    )
    default_to_invoice = fields.Boolean(
        string="Invoice",
        default=False,
        help="If ticked, POS orders will have the Invoice option checked by default.",
    )
    khr_exchange_rate = fields.Float(
        string="KHR Exchange Rate",
        default=4150.0,
        help="Exchange rate from USD to KHR (e.g. 4150).",
    )
    receipt_header_company_name = fields.Char(
        string="Receipt Company Name",
        compute="_compute_receipt_header_company_name",
        store=True,
        readonly=False,
        help="Company name displayed on the receipt header. Defaults to current company name.",
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
    receipt_custom_logo = fields.Binary(
        string="Receipt Custom Logo",
        help="Optional custom logo for the receipt. If unset, uses company logo.",
    )
    has_receipt_custom_logo = fields.Boolean(
        string="Has Custom Receipt Logo",
        compute="_compute_has_receipt_custom_logo",
        store=True,
    )
    receipt_footer_note = fields.Char(
        string="Receipt Footer Note",
        default="Thank you for coming! Please come again!",
        help="Closing greeting printed at the bottom of the receipt.",
    )
    receipt_show_signature = fields.Boolean(
        string="Show Signature Line",
        default=True,
        help="Show customer signature line at the bottom of the receipt.",
    )
    receipt_font_size = fields.Integer(
        string="Receipt Font Size (px)",
        default=16,
        help="Base font size in pixels for the receipt (default 16px).",
    )
    enable_2x_printing = fields.Boolean(
        string="Enable 2x Printing",
        help="Print the receipt twice (2x) for each order (e.g. on ePOS printer).",
    )
    print_bill_on_order = fields.Boolean(
        string="Print Bill on Order",
        help="Automatically print the bill (customer receipt) when the cashier clicks the Order button.",
    )

    @api.depends('receipt_custom_logo')
    def _compute_has_receipt_custom_logo(self):
        for config in self:
            config.has_receipt_custom_logo = bool(config.receipt_custom_logo)

    @api.depends('company_id.name')
    def _compute_receipt_header_company_name(self):
        for config in self:
            if not config.receipt_header_company_name:
                config.receipt_header_company_name = config.company_id.name or ""

    @api.depends('company_id.vat')
    def _compute_receipt_vat_tin(self):
        for config in self:
            if not config.receipt_vat_tin:
                config.receipt_vat_tin = config.company_id.vat or ""

    @api.depends('company_id')
    def _compute_receipt_address(self):
        for config in self:
            if not config.receipt_address:
                company = config.company_id
                address = getattr(company, 'english_address', False)
                if not address:
                    parts = [p for p in [company.street, company.street2, company.city, company.country_id.name] if p]
                    address = ", ".join(parts) if parts else ""
                config.receipt_address = address or ""

    @api.depends('company_id.phone')
    def _compute_receipt_phone(self):
        for config in self:
            if not config.receipt_phone:
                config.receipt_phone = config.company_id.phone or ""

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        company_id = res.get('company_id') or self.env.company.id
        company = self.env['res.company'].browse(company_id)
        if 'receipt_header_company_name' in fields_list and not res.get('receipt_header_company_name'):
            res['receipt_header_company_name'] = company.name or ""
        if 'receipt_vat_tin' in fields_list and not res.get('receipt_vat_tin'):
            res['receipt_vat_tin'] = company.vat or ""
        if 'receipt_address' in fields_list and not res.get('receipt_address'):
            res['receipt_address'] = getattr(company, 'english_address', False) or ", ".join([p for p in [company.street, company.street2, company.city, company.country_id.name] if p]) or ""
        if 'receipt_phone' in fields_list and not res.get('receipt_phone'):
            res['receipt_phone'] = company.phone or ""
        return res

