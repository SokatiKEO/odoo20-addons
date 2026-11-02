from odoo import api, models


class PosPrepStage(models.Model):
    _inherit = "pos.prep.stage"

    @api.model
    def _load_pos_data_domain(self, data):
        """Load only the stages configured on the kitchen displays of the session's POS.

        ``pos.prep.display`` is loaded before ``pos.prep.stage`` in the session
        model list, so its records are available in ``data``.

        :param dict data: Mapping of model name to already loaded recordsets.
        :return: Domain restricting stages to the loaded displays.
        """
        displays = data.get("pos.prep.display")
        if displays and displays.stage_ids:
            return [("id", "in", displays.stage_ids.ids)]
        return []

    @api.model
    def _load_pos_data_fields(self, config):
        """Fields required by the POS to render preparation stage badges.

        :param config: ``pos.config`` record of the loading session.
        :return: List of field names to load.
        """
        return ["id", "name", "color", "sequence"]
