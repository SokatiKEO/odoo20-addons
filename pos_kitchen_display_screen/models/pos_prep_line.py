from odoo import api, models, fields


class PosPrepLine(models.Model):
    _inherit = "pos.prep.line"

    def _get_prep_status(self):
        """Determine real-time preparation status for cashier and customer display.

        Stages logic:
        - Combo parent: derived from its child prep lines (combo_line_ids).
        - If no stage_id: not in preparation yet, returns False.
        - Last stage (Completed / Served): always 'served'.
        - Ready stage: 'served' if ticked done (todo=False); 'ready' if waiting for pickup (todo=True).
        - Intermediate/First stage: 'ready' if ticked done (todo=False, finished cooking); False if cooking (todo=True).
        """
        self.ensure_one()
        if self.cancelled:
            return False

        # Combo parent line: status is derived from its child prep lines
        if self.product_id.type == "combo" or self.combo_line_ids:
            if not self.combo_line_ids:
                return False
            child_statuses = [child._get_prep_status() for child in self.combo_line_ids if not child.cancelled]
            if child_statuses and all(s == "served" for s in child_statuses):
                return "served"
            if any(s == "ready" for s in child_statuses):
                return "ready"
            return False

        stage = self.stage_id
        if not stage:
            return False

        stages = stage.prep_display_ids.stage_ids.sorted(key=lambda s: (s.sequence, s.id))
        if not stages:
            stages = self.env["pos.prep.stage"].search([], order="sequence, id")

        is_last = (stage.id == stages[-1].id) if stages else self.is_last_stage

        # 1. Final stage: always served / completed
        if is_last:
            return "served"

        # 2. When the kitchen ticks the item as done (todo=False), it is ready for collection
        if not self.todo:
            return "ready"

        # 3. Intermediate/cooking stages in progress (todo=True): returns False so stage name/color is used
        return False

    def change_prep_line_stage(self, prep_display_id, direction=1):
        """Override to notify POS cashier and customer self-order when kitchen changes line stage."""
        res = super().change_prep_line_stage(prep_display_id, direction=direction)
        self._notify_pos_cashier_stage()
        return res

    def change_state_status(self, todos):
        """Override to notify POS cashier and customer self-order when item completion status changes."""
        res = super().change_state_status(todos)
        self._notify_pos_cashier_stage()
        return res

    def write(self, vals):
        """Notify POS cashier and customer self-order on any stage or completion state updates."""
        res = super().write(vals)
        if "stage_id" in vals or "todo" in vals or "cancelled" in vals:
            self._notify_pos_cashier_stage()
        return res

    def _notify_pos_cashier_stage(self):
        """Broadcast preparation stage changes to POS cashier sessions and self-order via bus."""
        configs_to_notify = {}

        for prep_line in self:
            order_line = prep_line.pos_order_line_id
            order = prep_line.prep_order_id.pos_order_id or (order_line.order_id if order_line else False)
            if not order or not order.config_id:
                continue

            # Touch write_date on order so self-order cache invalidation detects updates
            order.write({"write_date": fields.Datetime.now()})

            config = order.config_id
            if config not in configs_to_notify:
                configs_to_notify[config] = []

            status = prep_line._get_prep_status()
            stage = prep_line.stage_id

            stages = stage.prep_display_ids.stage_ids.sorted(key=lambda s: (s.sequence, s.id)) if stage else False
            if not stages and config:
                stages = config._get_kds_prep_stages()
            if not stages:
                stages = prep_line.env["pos.prep.stage"].search([], order="sequence, id")

            last_stage = stages[-1] if stages else False
            ready_stage = stages.filtered(lambda s: "ready" in s.name.lower()) if stages else False
            if not ready_stage and len(stages) > 2:
                ready_stage = stages[-2]
            elif not ready_stage and len(stages) > 1:
                ready_stage = stages[1]

            if status == "served":
                display_stage_name = last_stage.name if last_stage else "Served"
                display_stage_color = last_stage.color if last_stage else "#59C629"
                display_stage_id = last_stage.id if last_stage else (stage.id if stage else None)
            elif status == "ready":
                display_stage_name = ready_stage.name if ready_stage else "Ready"
                display_stage_color = ready_stage.color if ready_stage else "#008bf5"
                display_stage_id = ready_stage.id if ready_stage else (stage.id if stage else None)
            else:
                display_stage_name = stage.name if stage else ""
                display_stage_color = stage.color if stage else ""
                display_stage_id = stage.id if stage else None

            stage_change_time = fields.Datetime.to_string(prep_line.last_stage_change or fields.Datetime.now())
            sent_time = fields.Datetime.to_string(prep_line.create_date or fields.Datetime.now())
            cashier_name = order.cashier_name or (order.employee_id.name if hasattr(order, "employee_id") and order.employee_id else (order.user_id.name if order.user_id else ""))

            configs_to_notify[config].append({
                "order_id": order.id,
                "order_uuid": getattr(order, "uuid", None),
                "line_id": order_line.id if order_line else None,
                "line_uuid": order_line.uuid if order_line else None,
                "status": status,
                "stage_id": display_stage_id,
                "stage_name": display_stage_name,
                "stage_color": display_stage_color,
                "stage_change_time": stage_change_time,
                "sent_time": sent_time,
                "cashier_name": cashier_name,
            })

            # If this is a child line of a combo, also notify the combo parent orderline
            if prep_line.combo_parent_id and prep_line.combo_parent_id.pos_order_line_id:
                parent_prep = prep_line.combo_parent_id
                parent_line = parent_prep.pos_order_line_id
                parent_status = parent_prep._get_prep_status()
                parent_stage = parent_prep.stage_id or stage

                if parent_status == "served":
                    p_stage_name = last_stage.name if last_stage else "Served"
                    p_stage_color = last_stage.color if last_stage else "#59C629"
                    p_stage_id = last_stage.id if last_stage else None
                elif parent_status == "ready":
                    p_stage_name = ready_stage.name if ready_stage else "Ready"
                    p_stage_color = ready_stage.color if ready_stage else "#008bf5"
                    p_stage_id = ready_stage.id if ready_stage else None
                else:
                    p_stage_name = parent_stage.name if parent_stage else ""
                    p_stage_color = parent_stage.color if parent_stage else ""
                    p_stage_id = parent_stage.id if parent_stage else None

                configs_to_notify[config].append({
                    "order_id": order.id,
                    "order_uuid": getattr(order, "uuid", None),
                    "line_id": parent_line.id,
                    "line_uuid": parent_line.uuid,
                    "status": parent_status,
                    "stage_id": p_stage_id,
                    "stage_name": p_stage_name,
                    "stage_color": p_stage_color,
                    "stage_change_time": stage_change_time,
                    "sent_time": sent_time,
                    "cashier_name": cashier_name,
                })

        for config, updates in configs_to_notify.items():
            config._notify("POS_PREP_STAGE_UPDATE", {"updates": updates})
            config._notify("ORDER_STATE_CHANGED", {})
