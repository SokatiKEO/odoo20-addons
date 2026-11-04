import json

from markupsafe import Markup
from odoo import _, http
from odoo.addons.pos_enterprise.controllers.main import PosPreparationDisplayController
from odoo.http import request


class PosPreparationScreenManagerController(PosPreparationDisplayController):
    """Extend Preparation Display controller with read-only and multi-screen manager routes."""

    @http.route(["/pos_preparation_display/web/"], type="http", auth="user", methods=["GET"])
    def display_preparation_web(self, display_id=False, readonly=False, embed=False, **kw):
        """Render a single preparation display with optional read-only and embedded flags.

        :param display_id: ID of the ``pos.prep.display`` record.
        :param readonly: Truthy string/flag ("1", "true") to enforce read-only mode.
        :param embed: Truthy string/flag ("1", "true") when embedded inside the Manager Screen hub.
        :return: HTTP response rendering ``pos_enterprise.prep_display_index``.
        """
        if not display_id:
            return request.redirect("/odoo/action-pos_enterprise.action_preparation_display")

        preparation_display = request.env["pos.prep.display"].search([
            ("id", "=", int(display_id)),
        ], limit=1)
        if not preparation_display:
            return request.redirect("/odoo/action-pos_enterprise.action_preparation_display")

        is_readonly = str(readonly).lower() in ("1", "true", "yes")
        is_embed = str(embed).lower() in ("1", "true", "yes")

        session_info = request.env["ir.http"].session_info()
        prep_data = preparation_display.read(["id", "name", "access_token"])[0]
        prep_data["is_readonly"] = is_readonly
        prep_data["is_embed"] = is_embed
        session_info["preparation_display"] = prep_data
        session_info["nomenclature_id"] = preparation_display.company_id.nomenclature_id.id

        pos_configs = preparation_display._get_pos_config_ids()
        context = {
            "session_info": session_info,
            "prep_display_id": preparation_display.id,
            "pos_config_id": pos_configs[0].id if pos_configs else False,
        }
        return request.render("pos_enterprise.prep_display_index", context)

    @http.route(["/pos_preparation_display/manager"], type="http", auth="user", methods=["GET"])
    def display_preparation_manager(self, manager_id=False, **kw):
        """Render the multi-screen read-only Manager Preparation Screen interface.

        :param manager_id: Optional ID of ``pos.prep.screen.manager`` configuration record.
        :return: HTTP response rendering ``pos_preparation_screen_manager.manager_screen_index``.
        """
        ManagerModel = request.env["pos.prep.screen.manager"]
        manager_record = ManagerModel.browse()

        if manager_id and str(manager_id).isdigit():
            manager_record = ManagerModel.search([
                ("id", "=", int(manager_id)),
                ("company_id", "in", [False, request.env.company.id]),
            ], limit=1)

        if not manager_record:
            manager_record = ManagerModel.search([
                ("company_id", "in", [False, request.env.company.id]),
            ], limit=1)

        if not manager_record:
            manager_record = ManagerModel.sudo().create({
                "name": _("Manager Preparation Screen"),
                "company_id": request.env.company.id,
                "default_view_mode": "split",
                "grid_columns": "auto",
            })

        all_displays = request.env["pos.prep.display"].search([
            ("company_id", "in", [False, manager_record.company_id.id]),
        ])
        effective_displays = manager_record._get_effective_displays()
        selected_ids = effective_displays.ids

        displays_payload = []
        for display in all_displays:
            displays_payload.append({
                "id": display.id,
                "name": display.name,
                "order_count": display.order_count,
                "average_time": display.average_time,
                "stages": [s.name for s in display.stage_ids],
                "categories": [c.name for c in display.category_ids],
                "embed_url": f"/pos_preparation_display/web/?display_id={display.id}&readonly=1&embed=1",
                "standalone_url": f"/pos_preparation_display/web/?display_id={display.id}&readonly=1",
            })

        manager_config = {
            "id": manager_record.id,
            "name": manager_record.name,
            "default_view_mode": manager_record.default_view_mode or "split",
            "grid_columns": manager_record.grid_columns or "auto",
            "selected_display_ids": selected_ids,
            "all_displays": displays_payload,
            "can_configure": request.env.user.has_group("point_of_sale.group_pos_manager"),
            "backend_url": "/odoo/action-pos_preparation_screen_manager.action_pos_prep_screen_manager",
        }

        context = {
            "manager_config": manager_config,
            "manager_config_json": Markup(json.dumps(manager_config)),
            "theme": request.cookies.get("prep_theme", "light"),
        }
        return request.render("pos_preparation_screen_manager.manager_screen_index", context)

    @http.route(
        ["/pos_preparation_display/manager/save_config"],
        type="jsonrpc",
        auth="user",
        methods=["POST"],
    )
    def save_manager_configuration(
        self,
        manager_id=False,
        display_ids=None,
        view_mode=None,
        grid_columns=None,
    ):
        """Persist updated screen selection and layout preferences for a Manager Screen.

        :param int manager_id: ID of ``pos.prep.screen.manager``.
        :param list[int] display_ids: Selected ``pos.prep.display`` IDs.
        :param str view_mode: 'split' or 'tabs'.
        :param str grid_columns: 'auto', '1', '2', '3', or '4'.
        :return: Dict with status and saved values.
        """
        if not manager_id:
            return {"status": "error", "message": _("Missing manager screen ID.")}

        manager = request.env["pos.prep.screen.manager"].search([
            ("id", "=", int(manager_id)),
            ("company_id", "in", [False, request.env.company.id]),
        ], limit=1)
        if not manager:
            return {"status": "error", "message": _("Manager screen not found.")}

        if not request.env.user.has_group("point_of_sale.group_pos_manager"):
            return {"status": "local_only"}

        vals = {}
        if display_ids is not None:
            valid_displays = request.env["pos.prep.display"].search([
                ("id", "in", [int(did) for did in display_ids]),
                ("company_id", "in", [False, manager.company_id.id]),
            ])
            vals["preparation_display_ids"] = [(6, 0, valid_displays.ids)]
        if view_mode in ("split", "tabs"):
            vals["default_view_mode"] = view_mode
        if grid_columns in ("auto", "1", "2", "3", "4"):
            vals["grid_columns"] = grid_columns

        if vals:
            manager.write(vals)

        return {
            "status": "ok",
            "selected_display_ids": manager._get_effective_displays().ids,
        }

