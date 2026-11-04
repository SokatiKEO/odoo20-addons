from odoo import _, api, fields, models


class PosPrepScreenManager(models.Model):
    _name = "pos.prep.screen.manager"
    _description = "POS Preparation Screen Manager"
    _order = "sequence, id"

    name = fields.Char(
        string="Manager Screen Name",
        required=True,
        default=lambda self: _("Manager Preparation Screen"),
    )
    sequence = fields.Integer(string="Sequence", default=10)
    active = fields.Boolean(string="Active", default=True)
    company_id = fields.Many2one(
        comodel_name="res.company",
        string="Company",
        required=True,
        default=lambda self: self.env.company,
    )
    preparation_display_ids = fields.Many2many(
        comodel_name="pos.prep.display",
        relation="pos_prep_screen_manager_display_rel",
        column1="manager_id",
        column2="display_id",
        string="Preparation Screens",
        domain="[('company_id', '=', company_id)]",
        help="Preparation screens to monitor. If left empty, all preparation screens of the company are included automatically.",
    )
    default_view_mode = fields.Selection(
        selection=[
            ("split", "Split Grid (Multiple Screens at Once)"),
            ("tabs", "Tabs (Switch Between Screens)"),
        ],
        string="Default View Mode",
        default="split",
        required=True,
        help="Default layout on desktop/tablet. Mobile devices automatically default to Tabs for optimal readability but can switch to Split Grid at any time.",
    )
    grid_columns = fields.Selection(
        selection=[
            ("auto", "Auto Fit"),
            ("1", "1 Column (Stacked)"),
            ("2", "2 Columns"),
            ("3", "3 Columns"),
            ("4", "4 Columns"),
        ],
        string="Split Grid Columns",
        default="auto",
        required=True,
    )
    display_count = fields.Integer(
        string="Screen Count",
        compute="_compute_display_metrics",
    )
    total_order_count = fields.Integer(
        string="In Progress Orders",
        compute="_compute_display_metrics",
    )
    average_time = fields.Integer(
        string="Average Time (min)",
        compute="_compute_display_metrics",
    )

    def _get_effective_displays(self):
        """Return the preparation displays monitored by this manager screen.

        Purpose:
            Resolves the explicit ``preparation_display_ids`` or falls back to
            all preparation displays belonging to the manager screen's company.
        Parameters:
            None (operates on singleton self).
        Return value:
            pos.prep.display: Recordset of monitored preparation displays.
        Side effects:
            None.
        """
        self.ensure_one()
        if self.preparation_display_ids:
            return self.preparation_display_ids.filtered(
                lambda d: d.company_id == self.company_id
            )
        return self.env["pos.prep.display"].search([
            ("company_id", "=", self.company_id.id),
        ])

    @api.depends("preparation_display_ids", "company_id")
    def _compute_display_metrics(self):
        """Compute screen count, total active orders, and average order time.

        Purpose:
            Aggregates live KPIs across all monitored preparation displays for
            the backend kanban and form views.
        Parameters:
            None.
        Return value:
            None.
        Side effects:
            Updates ``display_count``, ``total_order_count``, and ``average_time`` on ``self``.
        """
        for manager in self:
            displays = manager._get_effective_displays()
            manager.display_count = len(displays)
            manager.total_order_count = sum(displays.mapped("order_count"))
            active_times = [d.average_time for d in displays if d.average_time > 0]
            manager.average_time = (
                round(sum(active_times) / len(active_times)) if active_times else 0
            )

    def action_add_all_displays(self):
        """Populate ``preparation_display_ids`` with all company preparation displays.

        Purpose:
            Provides a one-click helper in the backend form view to add all
            existing preparation screens in the current company.
        Parameters:
            None.
        Return value:
            bool: True when completed.
        Side effects:
            Writes all company ``pos.prep.display`` IDs into ``preparation_display_ids``.
        """
        for manager in self:
            all_displays = self.env["pos.prep.display"].search([
                ("company_id", "=", manager.company_id.id),
            ])
            manager.preparation_display_ids = [(6, 0, all_displays.ids)]
        return True

    def open_manager_ui(self):
        """Open the read-only multi-screen Manager Preparation Display web interface.

        Purpose:
            Launches the responsive manager web UI for this configuration record.
        Parameters:
            None (operates on singleton self).
        Return value:
            dict: An ``ir.actions.act_url`` dictionary redirecting to the manager screen route.
        Side effects:
            None.
        """
        self.ensure_one()
        return {
            "type": "ir.actions.act_url",
            "url": f"/pos_preparation_display/manager?manager_id={self.id}",
            "target": "self",
        }

