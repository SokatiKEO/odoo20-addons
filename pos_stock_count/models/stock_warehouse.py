from odoo import api, models


class StockWarehouse(models.Model):
    _name = "stock.warehouse"
    _inherit = ["stock.warehouse", "pos.load.mixin"]

    @api.model
    def _load_pos_data_domain(self, data):
        """Return the domain to load warehouses for the active POS company.

        :param dict data: Dictionary of already loaded POS models.
        :return: Domain list filtering warehouses by company.
        :rtype: list
        """
        config = data.get("pos.config")
        if config:
            return [("company_id", "=", config.company_id.id)]
        return []

    @api.model
    def _load_pos_data_fields(self, config):
        """Return the list of warehouse fields required by the POS frontend.

        :param recordset config: Active ``pos.config`` record.
        :return: Field names to read for ``stock.warehouse``.
        :rtype: list[str]
        """
        return ["id", "name", "code"]
