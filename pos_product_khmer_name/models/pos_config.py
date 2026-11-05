from odoo import api, fields, models


class PosConfig(models.Model):
    _inherit = "pos.config"

    show_khmer_name = fields.Boolean(
        string="Show Product Khmer Name",
        default=False,
        help="If enabled, display the product's Khmer Name (when set) instead of the default name in POS, Kitchen Display, and Customer Self-Order.",
    )

    @api.model
    def _load_pos_preparation_data_fields(self):
        """Include show_khmer_name in the preparation display fields for pos.config.

        :return: List of field names to load for pos.config in preparation display
        :rtype: list[str]
        """
        res = super()._load_pos_preparation_data_fields()
        if "show_khmer_name" not in res:
            res.append("show_khmer_name")
        return res

    @api.model
    def _load_pos_self_data_fields(self, pos_config_id):
        """Include show_khmer_name in the self-order fields for pos.config.

        :param int pos_config_id: ID of the active pos.config
        :return: List of field names to load for pos.config in self-order
        :rtype: list[str]
        """
        res = super()._load_pos_self_data_fields(pos_config_id)
        if "show_khmer_name" not in res:
            res.append("show_khmer_name")
        return res


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    pos_show_khmer_name = fields.Boolean(
        related="pos_config_id.show_khmer_name",
        readonly=False,
    )

