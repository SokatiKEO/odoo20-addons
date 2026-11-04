from odoo import api, fields, models


class PosCategory(models.Model):
    _inherit = "pos.category"

    alert_timer = fields.Integer(
        string="Alert timer (min)",
        default=0,
        help="Preparation alert timer in minutes. If an order line belonging to this category exceeds this time, an alert is triggered in the kitchen display.",
    )

    @api.model
    def _load_pos_preparation_data_domain(self, data):
        """Domain to restrict loaded categories for preparation display.

        Includes child categories so that items inheriting timers from parent
        or belonging to descendant categories have access to alert_timer data.

        :param dict data: Mapping of model name to already loaded recordsets.
        :return list: Search domain for pos.category.
        """
        prep_display = data.get("pos.prep.display")
        if prep_display and prep_display.category_ids:
            all_categs = self.search([("id", "child_of", prep_display.category_ids.ids)])
            return [("id", "in", all_categs.ids)]
        return []

    @api.model
    def _load_pos_preparation_data_fields(self):
        """Fields required by the preparation display screen.

        :return list: Field names to load into the KDS store.
        """
        res = super()._load_pos_preparation_data_fields()
        for field in ("alert_timer", "parent_id", "name"):
            if field not in res:
                res.append(field)
        return res

    @api.model
    def _load_pos_data_fields(self, config):
        """Fields loaded during regular POS session initialization.

        :param pos.config config: Active POS configuration.
        :return list: Field names to load into POS session.
        """
        res = super()._load_pos_data_fields(config)
        if "alert_timer" not in res:
            res.append("alert_timer")
        return res

