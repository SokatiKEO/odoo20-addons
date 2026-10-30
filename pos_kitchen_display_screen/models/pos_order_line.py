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

    @api.depends("manual_served", "prep_line_ids.stage_id", "prep_line_ids.todo", "prep_line_ids.cancelled", "combo_line_ids.prep_status")
    def _compute_prep_status(self):
        """Compute the preparation status for cashier display.

        Returns:
            - 'served': if manually marked by cashier OR if all prep lines / combo children are Completed/Served.
            - 'ready': if any active prep line (or combo child line) is ready for pickup.
            - False: if lines are still in progress / cooking or unserved.
        """
        for line in self:
            # If manually marked served by cashier
            if line.manual_served:
                line.prep_status = "served"
                continue

            # If this is a combo parent line with combo child order lines
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

            # Exclude combo lines with no stage
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

    @api.model
    def _load_pos_data_fields(self, config):
        """Include prep_status and manual_served in the initial data loaded by POS sessions."""
        fields = super()._load_pos_data_fields(config)
        for field in ("prep_status", "manual_served"):
            if field not in fields:
                fields.append(field)
        return fields
