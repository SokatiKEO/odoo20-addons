from odoo import api, fields, models


class PosOrder(models.Model):
    _inherit = "pos.order"

    table_name = fields.Char(string="Table Name", compute="_compute_table_name")
    cashier_name = fields.Char(string="Cashier Name", compute="_compute_cashier_name")
    prep_status = fields.Char(
        string="Preparation Status",
        compute="_compute_prep_order_status",
        recursive=True,
        help="Overall preparation status of the order: 'served', 'ready', 'preparing', or False",
    )
    prep_stage_name = fields.Char(
        string="Preparation Stage Name",
        compute="_compute_prep_order_status",
        recursive=True,
        help="Display name of the overall preparation stage for this order",
    )
    prep_stage_color = fields.Char(
        string="Preparation Stage Color",
        compute="_compute_prep_order_status",
        recursive=True,
        help="Hex color of the overall preparation stage for this order",
    )
    prep_sent_time = fields.Datetime(
        string="Order Sent Time",
        compute="_compute_prep_order_status",
        recursive=True,
        help="Earliest time an item was sent to preparation",
    )
    prep_stage_change_time = fields.Datetime(
        string="Order Stage Change Time",
        compute="_compute_prep_order_status",
        recursive=True,
        help="Latest time an item stage changed in preparation",
    )

    @api.depends(
        "lines.prep_status",
        "lines.prep_stage_id",
        "lines.prep_stage_name",
        "lines.prep_stage_color",
        "lines.manual_served",
        "lines.prep_sent_time",
        "lines.prep_stage_change_time",
    )
    def _compute_prep_order_status(self):
        """Compute the overall preparation status, stage name, color, and timestamps dynamically from KDS stages."""
        for order in self:
            stages = order.config_id._get_kds_prep_stages() if order.config_id else False
            if not stages:
                stages = self.env["pos.prep.stage"].search([], order="sequence, id")
            first_stage = stages[0] if stages else False
            last_stage = stages[-1] if stages else False

            prep_lines = order.lines.filtered(
                lambda l: l.prep_stage_name or l.prep_status or l.manual_served or l.prep_line_ids
            )
            if not prep_lines:
                order.prep_status = False
                order.prep_stage_name = False
                order.prep_stage_color = False
                order.prep_sent_time = False
                order.prep_stage_change_time = False
                continue

            sent_times = [l.prep_sent_time for l in prep_lines if l.prep_sent_time]
            stage_times = [l.prep_stage_change_time for l in prep_lines if l.prep_stage_change_time]
            order.prep_sent_time = min(sent_times) if sent_times else False
            order.prep_stage_change_time = max(stage_times) if stage_times else (order.prep_sent_time or False)

            statuses = [l.prep_status for l in prep_lines]
            if statuses and all(s == "served" for s in statuses):
                order.prep_status = "served"
                order.prep_stage_name = last_stage.name if last_stage else ""
                order.prep_stage_color = last_stage.color if last_stage else "#59C629"
            elif any(s == "ready" for s in statuses):
                order.prep_status = "ready"
                ready_line = prep_lines.filtered(lambda l: l.prep_status == "ready")
                stage = ready_line[0].prep_stage_id if ready_line and ready_line[0].prep_stage_id else False
                if stage:
                    order.prep_stage_name = stage.name
                    order.prep_stage_color = stage.color or "#008bf5"
                else:
                    ready_stage = stages.filtered(lambda s: "ready" in s.name.lower()) if stages else False
                    if not ready_stage and len(stages) > 2:
                        ready_stage = stages[-2]
                    order.prep_stage_name = ready_stage.name if ready_stage else "Ready"
                    order.prep_stage_color = (ready_stage.color if ready_stage else False) or "#008bf5"
            else:
                order.prep_status = "preparing"
                stages_in_lines = [l.prep_stage_id for l in prep_lines if l.prep_stage_id]
                if stages_in_lines:
                    stages_sorted = sorted(stages_in_lines, key=lambda s: (s.sequence, s.id))
                    order.prep_stage_name = stages_sorted[0].name
                    order.prep_stage_color = stages_sorted[0].color or "#C8C9CB"
                else:
                    order.prep_stage_name = first_stage.name if first_stage else ""
                    order.prep_stage_color = first_stage.color if first_stage else "#C8C9CB"

    @api.depends("user_id")
    def _compute_cashier_name(self):
        """Compute the display name of the cashier / employee who handled the order."""
        for order in self:
            if hasattr(order, "employee_id") and order.employee_id:
                order.cashier_name = order.employee_id.name
            elif hasattr(order, "cashier") and order.cashier:
                order.cashier_name = order.cashier
            elif order.user_id:
                order.cashier_name = order.user_id.name
            else:
                order.cashier_name = False

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
        """Include table_name and cashier_name in the preparation display fields.

        :return: List of pos.order field names to load in preparation display.
        :rtype: list[str]
        """
        fields = super()._load_pos_preparation_data_fields()
        for field in ("table_name", "cashier_name"):
            if field not in fields:
                fields.append(field)
        return fields

    @api.model
    def _load_pos_self_data_fields(self, config):
        """Include preparation status, stage name, color, and timestamps in self-order data."""
        fields = super()._load_pos_self_data_fields(config)
        extra = [
            "table_name",
            "cashier_name",
            "prep_status",
            "prep_stage_name",
            "prep_stage_color",
            "prep_sent_time",
            "prep_stage_change_time",
        ]
        for field in extra:
            if field not in fields:
                fields.append(field)
        return fields
