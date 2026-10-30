from odoo import api, models


class ProductProduct(models.Model):
    _inherit = "product.product"

    @api.model
    def _load_pos_preparation_data_fields(self):
        """Include write_date in preparation display fields for image cache busting."""
        fields = super()._load_pos_preparation_data_fields()
        if "write_date" not in fields:
            fields.append("write_date")
        return fields

