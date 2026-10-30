from odoo import api, models


class StockPicking(models.Model):
    _inherit = "stock.picking"

    @api.model
    def _create_picking_from_pos_order_lines(
        self, location_dest_id, lines, picking_type, partner=False
    ):
        if "ab_lines" in self.env.context:
            lines = self.env.context["ab_lines"]
        return super()._create_picking_from_pos_order_lines(
            location_dest_id, lines, picking_type, partner
        )
