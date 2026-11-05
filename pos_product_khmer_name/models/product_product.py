from odoo import api, fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    khmer_name = fields.Char(
        string="Khmer Name",
        help="Name of the product in Khmer language.",
        translate=True,
    )

    @api.model
    def _load_pos_data_fields(self, config):
        """Include khmer_name in the product.template fields loaded into POS and Self-Order.

        :param recordset config: Active pos.config record
        :return: List of field names to load for product.template
        :rtype: list[str]
        """
        fields_list = super()._load_pos_data_fields(config)
        if "khmer_name" not in fields_list:
            fields_list.append("khmer_name")
        return fields_list


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
        """Include khmer_name in the product.product fields loaded into POS and Self-Order.

        :param recordset config: Active pos.config record
        :return: List of field names to load for product.product
        :rtype: list[str]
        """
        fields_list = super()._load_pos_data_fields(config)
        if "khmer_name" not in fields_list:
            fields_list.append("khmer_name")
        return fields_list

    @api.model
    def _load_pos_preparation_data_fields(self):
        """Include khmer_name in the preparation display fields for product.product.

        :return: List of field names to load in preparation display
        :rtype: list[str]
        """
        fields_list = super()._load_pos_preparation_data_fields()
        if "khmer_name" not in fields_list:
            fields_list.append("khmer_name")
        return fields_list

