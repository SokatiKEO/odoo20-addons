# -*- coding: utf-8 -*-
from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    pos_default_partner_id = fields.Many2one(
        related='pos_config_id.default_partner_id',
        readonly=False,
        string="Default POS Customer",
    )
    pos_default_to_invoice = fields.Boolean(
        related='pos_config_id.default_to_invoice',
        readonly=False,
        string="Invoice",
    )
    pos_khr_exchange_rate = fields.Float(
        related='pos_config_id.khr_exchange_rate',
        readonly=False,
    )
    pos_receipt_header_company_name = fields.Char(
        related='pos_config_id.receipt_header_company_name',
        readonly=False,
    )
    pos_receipt_vat_tin = fields.Char(
        related='pos_config_id.receipt_vat_tin',
        readonly=False,
    )
    pos_receipt_address = fields.Char(
        related='pos_config_id.receipt_address',
        readonly=False,
    )
    pos_receipt_phone = fields.Char(
        related='pos_config_id.receipt_phone',
        readonly=False,
    )
    pos_receipt_custom_logo = fields.Binary(
        related='pos_config_id.receipt_custom_logo',
        readonly=False,
    )
    pos_receipt_footer_note = fields.Char(
        related='pos_config_id.receipt_footer_note',
        readonly=False,
    )
    pos_receipt_show_signature = fields.Boolean(
        related='pos_config_id.receipt_show_signature',
        readonly=False,
    )
    pos_receipt_font_size = fields.Integer(
        related='pos_config_id.receipt_font_size',
        readonly=False,
    )
    pos_enable_2x_printing = fields.Boolean(
        related='pos_config_id.enable_2x_printing',
        readonly=False,
        string="Enable 2x Printing",
    )
    pos_print_bill_on_order = fields.Boolean(
        related='pos_config_id.print_bill_on_order',
        readonly=False,
        string="Print Bill on Order",
    )
