from odoo import api, fields, models

KHMER_CONFIG_FIELDS = [
    "khmer_name_display_mode",
    "khmer_name_apply_pos",
    "khmer_name_apply_self_order",
    "khmer_name_apply_kitchen",
]


class PosConfig(models.Model):
    _inherit = "pos.config"

    khmer_name_display_mode = fields.Selection(
        selection=[
            ("both", "Show Both (Khmer name / English name)"),
            ("khmer_only", "Show Khmer Name"),
        ],
        string="Khmer Name Display Mode",
        default="khmer_only",
        help="Choose how to display the product's Khmer Name when set.",
    )
    khmer_name_apply_pos = fields.Boolean(
        string="Apply Khmer Name to POS",
        default=False,
        help="Apply Khmer Name display setting to Point of Sale.",
    )
    khmer_name_apply_self_order = fields.Boolean(
        string="Apply Khmer Name to Self Order",
        default=False,
        help="Apply Khmer Name display setting to Customer Self-Order.",
    )
    khmer_name_apply_kitchen = fields.Boolean(
        string="Apply Khmer Name to Kitchen",
        default=False,
        help="Apply Khmer Name display setting to Kitchen Display.",
    )

    @api.model
    def _load_pos_preparation_data_fields(self):
        """Include Khmer Name configuration fields in preparation display data for pos.config.

        :return: List of field names to load for pos.config in preparation display
        :rtype: list[str]
        """
        res = super()._load_pos_preparation_data_fields()
        for field_name in KHMER_CONFIG_FIELDS:
            if field_name not in res:
                res.append(field_name)
        return res

    @api.model
    def _load_pos_self_data_fields(self, pos_config_id):
        """Include Khmer Name configuration fields in self-order data for pos.config.

        :param int pos_config_id: ID of the active pos.config
        :return: List of field names to load for pos.config in self-order
        :rtype: list[str]
        """
        res = super()._load_pos_self_data_fields(pos_config_id)
        for field_name in KHMER_CONFIG_FIELDS:
            if field_name not in res:
                res.append(field_name)
        return res


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    pos_khmer_name_display_mode = fields.Selection(
        related="pos_config_id.khmer_name_display_mode",
        readonly=False,
    )
    pos_khmer_name_apply_pos = fields.Boolean(
        related="pos_config_id.khmer_name_apply_pos",
        readonly=False,
    )
    pos_khmer_name_apply_self_order = fields.Boolean(
        related="pos_config_id.khmer_name_apply_self_order",
        readonly=False,
    )
    pos_khmer_name_apply_kitchen = fields.Boolean(
        related="pos_config_id.khmer_name_apply_kitchen",
        readonly=False,
    )
