# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class PosOrderReceipt(models.AbstractModel):
    _inherit = 'pos.order.receipt'

    def _set_pos_restaurant_receipt_common_data(self, data):
        """Populate ``extra_data['table_name']`` with the custom table name if set, falling back to table number.

        Parameters:
            data (dict): Receipt data dictionary containing ``extra_data``.

        Returns:
            None

        Side effects:
            Mutates ``data['extra_data']['table_name']`` in place when a restaurant table is linked.
        """
        super()._set_pos_restaurant_receipt_common_data(data)
        if self.config_id.module_pos_restaurant and self.table_id:
            data['extra_data']['table_name'] = self.table_id.table_name or self.table_id.table_number
