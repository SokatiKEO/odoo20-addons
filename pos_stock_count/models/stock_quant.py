from odoo import api, models


class StockQuant(models.Model):
    _inherit = "stock.quant"

    @api.model_create_multi
    def create(self, vals_list):
        """Create stock quants and record modified products for POS notification.

        :param list[dict] vals_list: Field values for new ``stock.quant`` records.
        :return: Created ``stock.quant`` recordset.
        :rtype: recordset
        """
        res = super().create(vals_list)
        res.product_id.note_change()
        return res

    def write(self, vals):
        """Update stock quants and record modified products for POS notification.

        :param dict vals: Updated field values.
        :return: True if write succeeded.
        :rtype: bool
        """
        self.product_id.note_change()
        res = super().write(vals)
        self.product_id.note_change()
        return res
