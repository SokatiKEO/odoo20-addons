from odoo import api, fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    khmer_name = fields.Char(
        string="Khmer Name",
        help="Name of the product in Khmer language.",
        translate=True,
    )


class ProductProduct(models.Model):
    _inherit = "product.product"

    khmer_name = fields.Char(
        string="Khmer Name",
        related="product_tmpl_id.khmer_name",
        readonly=False,
        help="Name of the product in Khmer language.",
    )

    @api.model
    def _load_pos_data_fields(self, config):
        """Include khmer_name in the fields loaded into the POS session."""
        fields = super()._load_pos_data_fields(config)
        if "khmer_name" not in fields:
            fields.append("khmer_name")
        return fields

    @api.model
    def _load_pos_preparation_data_fields(self):
        """Include khmer_name in the preparation display fields."""
        fields = super()._load_pos_preparation_data_fields()
        if "khmer_name" not in fields:
            fields.append("khmer_name")
        return fields
