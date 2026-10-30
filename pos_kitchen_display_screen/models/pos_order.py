from odoo import api, fields, models


class PosOrder(models.Model):
    _inherit = "pos.order"

    table_name = fields.Char(string="Table Name", compute="_compute_table_name")

    @api.depends("table_id")
    def _compute_table_name(self):
        """Compute the custom table name or table label for Kitchen Display Screen.

        Uses ``table_name`` from ``pos_table_name`` if set, falling back to
        table number or table display name, including merged child tables.
        """
        for order in self:
            if hasattr(order, "table_id") and order.table_id:
                table = order.table_id
                name = getattr(table, "table_name", None) or getattr(table, "table_number", None)
                label = str(name) if name else getattr(table, "name", "") or table.display_name or ""
                if hasattr(table, "floor_id") and table.floor_id:
                    child_tables = self.env["restaurant.table"].search([
                        ("parent_id", "=", table.id),
                        ("floor_id", "=", table.floor_id.id),
                    ])
                    for child in child_tables:
                        c_name = getattr(child, "table_name", None) or getattr(child, "table_number", None)
                        if c_name:
                            label += f" & {c_name}"
                order.table_name = label or False
            else:
                order.table_name = False

    @api.model
    def _load_pos_preparation_data_fields(self):
        """Include ``table_name`` in the preparation display fields.

        :return: List of ``pos.order`` field names to load in preparation display.
        :rtype: list[str]
        """
        fields = super()._load_pos_preparation_data_fields()
        if "table_name" not in fields:
            fields.append("table_name")
        return fields

