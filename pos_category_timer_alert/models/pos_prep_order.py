from odoo import api, models


class PosPrepOrder(models.Model):
    _inherit = "pos.prep.order"

    @api.model
    def _load_pos_preparation_data_fields(self):
        """Ensure order batch creation timestamp is loaded into the KDS store for duration tracking.

        :return list: Field names to read for preparation orders.
        """
        res = super()._load_pos_preparation_data_fields()
        if res and "create_date" not in res:
            res.append("create_date")
        return res

