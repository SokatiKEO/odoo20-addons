from odoo import api, fields, models


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    ab_warehouse_id = fields.Many2one("stock.warehouse", string="Warehouse")

    @api.model
    def _load_pos_data_fields(self, config):
        """Include ``ab_warehouse_id`` in POS order line fields.

        :param recordset config: Active ``pos.config`` record.
        :return: List of ``pos.order.line`` field names.
        :rtype: list[str]
        """
        field_names = super()._load_pos_data_fields(config)
        if "ab_warehouse_id" not in field_names:
            field_names.append("ab_warehouse_id")
        return field_names


class PosOrder(models.Model):
    _inherit = "pos.order"

    def _create_order_picking(self):
        """Create stock pickings per selected warehouse on order lines.

        Order lines with a custom ``ab_warehouse_id`` different from the POS
        default warehouse get separate pickings using that warehouse's POS
        operation type.
        """
        self.ensure_one()
        if self.picking_ids:
            return

        lines_without_wh = self.lines.filtered(
            lambda line: not line.ab_warehouse_id
            or line.ab_warehouse_id == self.config_id.warehouse_id
        )
        lines_with_wh = self.lines - lines_without_wh

        res = super(
            PosOrder, self.with_context(ab_lines=lines_without_wh)
        )._create_order_picking()

        if (
            lines_with_wh
            and not self.shipping_date
            and self._should_create_picking_real_time()
        ):
            for warehouse in lines_with_wh.mapped("ab_warehouse_id"):
                picking_type = warehouse.pos_type_id or self.config_id.picking_type_id
                destination_id = picking_type.default_location_dest_id.id
                if self.partner_id.property_stock_customer:
                    destination_id = self.partner_id.property_stock_customer.id
                wh_lines = lines_with_wh.filtered(
                    lambda line: line.ab_warehouse_id == warehouse
                )
                pickings = self.env[
                    "stock.picking"
                ]._create_picking_from_pos_order_lines(
                    destination_id, wh_lines, picking_type, self.partner_id
                )
                pickings.write(
                    {
                        "pos_session_id": self.session_id.id,
                        "pos_order_id": self.id,
                        "origin": self.name,
                    }
                )
                pickings.backorder_ids.write(
                    {
                        "pos_session_id": self.session_id.id,
                        "pos_order_id": self.id,
                        "origin": self.name,
                    }
                )

        return res
