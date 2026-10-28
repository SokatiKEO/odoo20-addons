# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class RestaurantTable(models.Model):
    _inherit = 'restaurant.table'

    table_name = fields.Char(
        string='Table Name',
        help='Custom name of the table as displayed on the floor plan and receipts.',
    )

    @api.depends('table_name', 'table_number', 'floor_id')
    def _compute_display_name(self):
        """Compute the display name using the custom table name when set, falling back to table number.

        Parameters:
            None

        Returns:
            None

        Side effects:
            Updates ``display_name`` on each record in ``self``.
        """
        for table in self:
            label = table.table_name or table.table_number
            if table.floor_id:
                table.display_name = f"{table.floor_id.name}, {label}"
            else:
                table.display_name = str(label)

    @api.model
    def _load_pos_data_fields(self, config):
        """Include ``table_name`` in the fields loaded into the POS frontend session.

        Parameters:
            config (pos.config): The active Point of Sale configuration record.

        Returns:
            list[str]: Field names to serialize for ``restaurant.table`` in POS.

        Side effects:
            None
        """
        fields_list = super()._load_pos_data_fields(config)
        if 'table_name' not in fields_list:
            fields_list.append('table_name')
        return fields_list
