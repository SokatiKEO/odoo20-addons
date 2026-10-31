from odoo import api, models


class RestaurantTable(models.Model):
    _inherit = "restaurant.table"

    @api.model
    def _load_pos_self_data_fields(self, config):
        """Include custom table name and parent table in self-order data."""
        fields = super()._load_pos_self_data_fields(config)
        for field in ("table_name", "parent_id"):
            if field not in fields:
                fields.append(field)
        return fields

