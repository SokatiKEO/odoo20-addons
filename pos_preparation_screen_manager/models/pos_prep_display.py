from odoo import models


class PosPrepDisplay(models.Model):
    _inherit = "pos.prep.display"

    def open_readonly_ui(self):
        """Open the current preparation display in read-only mode.

        Purpose:
            Allows managers or supervisors to view this specific preparation
            screen without being able to advance stages, toggle lines, or clear orders.
        Parameters:
            None (operates on singleton self).
        Return value:
            dict: An ``ir.actions.act_url`` dictionary redirecting to the read-only preparation UI.
        Side effects:
            None.
        """
        self.ensure_one()
        return {
            "type": "ir.actions.act_url",
            "url": f"/pos_preparation_display/web?display_id={self.id}&readonly=1",
            "target": "self",
        }

    def action_open_manager_screen(self):
        """Open the multi-screen Manager Preparation Display hub.

        Purpose:
            Redirects the user to the unified read-only manager interface
            monitoring all configured preparation displays.
        Parameters:
            None.
        Return value:
            dict: An ``ir.actions.act_url`` dictionary redirecting to ``/pos_preparation_display/manager``.
        Side effects:
            None.
        """
        return {
            "type": "ir.actions.act_url",
            "url": "/pos_preparation_display/manager",
            "target": "self",
        }

