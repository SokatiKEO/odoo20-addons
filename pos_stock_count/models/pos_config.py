from odoo import fields, models


class PosConfig(models.Model):
    _inherit = "pos.config"

    ab_stock_display = fields.Boolean(default=True, string="Display Stock in PoS")
    ab_stock_allow_select_wh = fields.Boolean(
        default=False, string="Allow Selecting Warehouse in PoS"
    )
    ab_stock_warehouse_ids = fields.Many2many(
        "stock.warehouse", string="Allowed Warehouses in PoS"
    )
    ab_stock_qty_type = fields.Selection(
        [
            ("qty_available", "On Hand"),
            ("free_qty", "Free to Use"),
            ("virtual_available", "Forecasted"),
        ],
        required=True,
        default="free_qty",
        string="Stock Quantity Type",
    )
    ab_stock_deny = fields.Boolean(default=True, string="Deny Order When Out of Stock")
    ab_stock_deny_qty = fields.Integer(default=0, string="Deny Order Quantity")
    ab_stock_low_stock = fields.Integer(default=0, string="Low Stock Threshold")
    ab_stock_show_Substitutes = fields.Boolean(
        default=False, string="Show Substitute Warehouses"
    )
    ab_stock_position = fields.Selection(
        [
            ("top-left", "Top Left"),
            ("top-right", "Top Right"),
            ("bottom-left", "Bottom Left"),
        ],
        required=True,
        default="top-left",
        string="Stock Badge Position",
    )

    @api.model
    def _load_pos_self_data_fields(self, config_id):
        """Append stock configuration fields to self-order POS config data.

        :param int config_id: POS configuration record ID.
        :return: List of ``pos.config`` field names to load in self-order.
        :rtype: list[str]
        """
        fields = super()._load_pos_self_data_fields(config_id)
        extra = [
            "warehouse_id",
            "ab_stock_qty_type",
            "ab_stock_deny",
            "ab_stock_deny_qty",
        ]
        for field in extra:
            if field not in fields:
                fields.append(field)
        return fields
