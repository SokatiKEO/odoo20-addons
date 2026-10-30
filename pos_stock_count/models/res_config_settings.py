from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    ab_stock_display = fields.Boolean(
        related="pos_config_id.ab_stock_display", readonly=False
    )
    ab_stock_allow_select_wh = fields.Boolean(
        related="pos_config_id.ab_stock_allow_select_wh", readonly=False
    )
    ab_stock_warehouse_ids = fields.Many2many(
        related="pos_config_id.ab_stock_warehouse_ids", readonly=False
    )
    ab_stock_qty_type = fields.Selection(
        related="pos_config_id.ab_stock_qty_type", readonly=False
    )
    ab_stock_deny = fields.Boolean(
        related="pos_config_id.ab_stock_deny", readonly=False
    )
    ab_stock_deny_qty = fields.Integer(
        related="pos_config_id.ab_stock_deny_qty", readonly=False
    )
    ab_stock_low_stock = fields.Integer(
        related="pos_config_id.ab_stock_low_stock", readonly=False
    )
    ab_stock_show_Substitutes = fields.Boolean(
        related="pos_config_id.ab_stock_show_Substitutes", readonly=False
    )
    ab_stock_position = fields.Selection(
        related="pos_config_id.ab_stock_position", readonly=False
    )
