from odoo import api, fields, models


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    manual_served = fields.Boolean(
        string="Manually Served",
        default=False,
        help="Indicates the item was marked as served directly by the cashier.",
    )
    prep_status = fields.Char(
        string="Preparation Status",
        compute="_compute_prep_status",
        recursive=True,
        help="Real-time preparation status from Kitchen Display or manual cashier service: 'ready', 'served', or False",
    )
    prep_stage_id = fields.Many2one(
        "pos.prep.stage",
        string="Preparation Stage",
        compute="_compute_prep_stage_id",
        recursive=True,
        help="Dynamic KDS preparation stage assigned to this item",
    )
    prep_sent_time = fields.Datetime(
        string="Sent to Kitchen Time",
        compute="_compute_prep_times",
        recursive=True,
        help="Timestamp when the order line was sent to the kitchen",
    )
    prep_stage_change_time = fields.Datetime(
        string="Stage Change Time",
        compute="_compute_prep_times",
        recursive=True,
        help="Timestamp when the preparation stage was last changed",
    )
    prep_stage_name = fields.Char(
        string="Preparation Stage Name",
        compute="_compute_prep_stage_display",
        recursive=True,
        help="Localized display name of the current preparation stage",
    )
    prep_stage_color = fields.Char(
        string="Preparation Stage Color",
        compute="_compute_prep_stage_display",
        recursive=True,
        help="Hex color code of the current preparation stage",
    )

    @api.depends(
        "prep_line_ids.create_date",
        "prep_line_ids.last_stage_change",
        "prep_line_ids.cancelled",
        "manual_served",
        "write_date",
        "combo_line_ids.prep_sent_time",
        "combo_line_ids.prep_stage_change_time",
    )
    def _compute_prep_times(self):
        """Compute timestamp when order line was sent to kitchen and when its stage changed."""
        for line in self:
            if line.manual_served:
                line.prep_sent_time = line.create_date or fields.Datetime.now()
                line.prep_stage_change_time = line.write_date or line.create_date or fields.Datetime.now()
                continue

            if line.combo_line_ids:
                sent_times = [c.prep_sent_time for c in line.combo_line_ids if c.prep_sent_time]
                stage_times = [c.prep_stage_change_time for c in line.combo_line_ids if c.prep_stage_change_time]
                line.prep_sent_time = min(sent_times) if sent_times else False
                line.prep_stage_change_time = max(stage_times) if stage_times else False
                continue

            active_prep = line.prep_line_ids.filtered(lambda pl: not pl.cancelled)
            if active_prep:
                sent_dates = [pl.create_date for pl in active_prep if pl.create_date]
                line.prep_sent_time = min(sent_dates) if sent_dates else False

                stage_dates = [pl.last_stage_change for pl in active_prep if pl.last_stage_change]
                line.prep_stage_change_time = max(stage_dates) if stage_dates else (line.prep_sent_time or False)
            else:
                line.prep_sent_time = False
                line.prep_stage_change_time = False

    @api.depends("prep_line_ids.stage_id", "prep_line_ids.cancelled", "manual_served", "combo_line_ids.prep_stage_id")
    def _compute_prep_stage_id(self):
        """Compute the preparation stage dynamically from linked prep lines or display stages."""
        for line in self:
            stages = line.order_id.config_id._get_kds_prep_stages() if line.order_id and line.order_id.config_id else False
            if not stages:
                stages = self.env["pos.prep.stage"].search([], order="sequence, id")
            last_stage = stages[-1] if stages else False

            if line.manual_served:
                line.prep_stage_id = last_stage
                continue

            if line.combo_line_ids:
                c_stages = [c.prep_stage_id for c in line.combo_line_ids if c.prep_stage_id]
                if c_stages and last_stage and all(s == last_stage for s in c_stages):
                    line.prep_stage_id = last_stage
                elif c_stages:
                    stages_sorted = sorted(c_stages, key=lambda s: (s.sequence, s.id))
                    line.prep_stage_id = stages_sorted[0]
                else:
                    line.prep_stage_id = False
                continue

            active_prep = line.prep_line_ids.filtered(lambda pl: not pl.cancelled and pl.stage_id)
            if active_prep:
                line.prep_stage_id = active_prep[-1].stage_id
            else:
                line.prep_stage_id = False

    @api.depends("manual_served", "prep_line_ids.stage_id", "prep_line_ids.todo", "prep_line_ids.cancelled", "combo_line_ids.prep_status")
    def _compute_prep_status(self):
        """Compute the preparation status for cashier display.

        Returns:
            - 'served': if manually marked by cashier OR if all prep lines / combo children are Completed/Served.
            - 'ready': if any active prep line (or combo child line) is ready for pickup.
            - False: if lines are still in progress / cooking or unserved.
        """
        for line in self:
            if line.manual_served:
                line.prep_status = "served"
                continue

            if line.combo_line_ids:
                child_statuses = [child.prep_status for child in line.combo_line_ids]
                if child_statuses and all(s == "served" for s in child_statuses):
                    line.prep_status = "served"
                elif any(s == "ready" for s in child_statuses):
                    line.prep_status = "ready"
                else:
                    line.prep_status = False
                continue

            active_prep_lines = line.prep_line_ids.filtered(lambda pl: not pl.cancelled)
            if not active_prep_lines:
                line.prep_status = False
                continue

            valid_prep_lines = active_prep_lines.filtered(lambda pl: pl.stage_id or pl.combo_line_ids)
            if not valid_prep_lines:
                line.prep_status = False
                continue

            statuses = [pl._get_prep_status() for pl in valid_prep_lines]
            if statuses and all(s == "served" for s in statuses):
                line.prep_status = "served"
            elif any(s == "ready" for s in statuses):
                line.prep_status = "ready"
            else:
                line.prep_status = False

    @api.depends(
        "prep_stage_id",
        "prep_status",
        "manual_served",
        "combo_line_ids.prep_stage_name",
        "combo_line_ids.prep_stage_color",
    )
    def _compute_prep_stage_display(self):
        """Compute localized stage name and hex color code dynamically from Kitchen Display stages."""
        for line in self:
            stages = line.order_id.config_id._get_kds_prep_stages() if line.order_id and line.order_id.config_id else False
            if not stages:
                stages = self.env["pos.prep.stage"].search([], order="sequence, id")
            first_stage = stages[0] if stages else False
            last_stage = stages[-1] if stages else False

            # 1. Final stage: Served / Completed
            if line.manual_served or line.prep_status == "served":
                line.prep_stage_name = last_stage.name if last_stage else "Served"
                line.prep_stage_color = last_stage.color if last_stage else "#59C629"
            # 2. Ready stage (e.g. checkbox ticked done by kitchen staff)
            elif line.prep_status == "ready":
                ready_stage = stages.filtered(lambda s: "ready" in s.name.lower()) if stages else False
                if not ready_stage and len(stages) > 2:
                    ready_stage = stages[-2]
                elif not ready_stage and len(stages) > 1:
                    ready_stage = stages[1]
                line.prep_stage_name = ready_stage.name if ready_stage else "Ready"
                line.prep_stage_color = (ready_stage.color if ready_stage else False) or "#008bf5"
            # 3. Active in-progress stage
            elif line.prep_stage_id:
                line.prep_stage_name = line.prep_stage_id.name
                line.prep_stage_color = line.prep_stage_id.color or "#C8C9CB"
            # 4. Fallback for items sent to kitchen
            elif line.prep_line_ids:
                line.prep_stage_name = first_stage.name if first_stage else ""
                line.prep_stage_color = first_stage.color if first_stage else "#C8C9CB"
            else:
                line.prep_stage_name = False
                line.prep_stage_color = False

    def write(self, vals):
        """Broadcast state updates to self-order and POS when cashier manually serves an item."""
        res = super().write(vals)
        if "manual_served" in vals:
            for line in self:
                if line.order_id:
                    line.order_id.write({"write_date": fields.Datetime.now()})
                    config = line.order_id.config_id
                    if config:
                        config._notify("ORDER_STATE_CHANGED", {})
                        stage_name = line.prep_stage_name or ("Served" if line.manual_served else "")
                        stage_color = line.prep_stage_color or ("#59C629" if line.manual_served else "")
                        status = "served" if line.manual_served else False
                        config._notify("POS_PREP_STAGE_UPDATE", {
                            "updates": [{
                                "order_id": line.order_id.id,
                                "order_uuid": getattr(line.order_id, "uuid", None),
                                "line_id": line.id,
                                "line_uuid": line.uuid,
                                "status": status,
                                "stage_id": line.prep_stage_id.id if line.prep_stage_id else None,
                                "stage_name": stage_name,
                                "stage_color": stage_color,
                                "stage_change_time": fields.Datetime.to_string(fields.Datetime.now()),
                                "sent_time": fields.Datetime.to_string(line.create_date or fields.Datetime.now()),
                                "cashier_name": line.order_id.cashier_name or "",
                            }]
                        })
        return res

    @api.model
    def _load_pos_data_fields(self, config):
        """Include preparation fields in the initial data loaded by POS sessions."""
        fields = super()._load_pos_data_fields(config)
        extra = (
            "prep_status",
            "prep_stage_id",
            "prep_stage_name",
            "prep_stage_color",
            "manual_served",
            "prep_sent_time",
            "prep_stage_change_time",
        )
        for field in extra:
            if field not in fields:
                fields.append(field)
        return fields

    @api.model
    def _load_pos_self_data_fields(self, config):
        """Include preparation fields in self-order lines."""
        fields = super()._load_pos_self_data_fields(config)
        extra = [
            "prep_status",
            "prep_stage_id",
            "prep_stage_name",
            "prep_stage_color",
            "prep_sent_time",
            "prep_stage_change_time",
            "manual_served",
        ]
        for field in extra:
            if field not in fields:
                fields.append(field)
        return fields
