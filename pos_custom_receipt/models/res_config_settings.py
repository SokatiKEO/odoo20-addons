from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    pos_khr_exchange_rate = fields.Float(
        related="pos_config_id.khr_exchange_rate",
        readonly=False,
    )
    pos_receipt_header_khmer_company_name = fields.Char(
        related="pos_config_id.receipt_header_khmer_company_name",
        readonly=False,
    )
    pos_receipt_header_company_name = fields.Char(
        related="pos_config_id.receipt_header_company_name",
        readonly=False,
    )
    pos_receipt_vat_tin = fields.Char(
        related="pos_config_id.receipt_vat_tin",
        readonly=False,
    )
    pos_receipt_address = fields.Char(
        related="pos_config_id.receipt_address",
        string="Custom Receipt Address",
        readonly=False,
    )
    pos_receipt_phone = fields.Char(
        related="pos_config_id.receipt_phone",
        readonly=False,
    )
    pos_receipt_footer_khmer_note = fields.Char(
        related="pos_config_id.receipt_footer_khmer_note",
        readonly=False,
    )
    pos_receipt_footer_note = fields.Char(
        related="pos_config_id.receipt_footer_note",
        readonly=False,
    )
    pos_receipt_font_size = fields.Integer(
        related="pos_config_id.receipt_font_size",
        readonly=False,
    )
