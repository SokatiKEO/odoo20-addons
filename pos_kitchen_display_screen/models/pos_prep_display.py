from odoo import api, models


class PosPrepDisplay(models.Model):
    _inherit = "pos.prep.display"

    @api.model
    def _load_pos_data_fields(self, config):
        """Expose the display's stages to the POS so the stage pipeline is resolved per display.

        :param config: ``pos.config`` record of the loading session.
        :return: List of field names to load.
        """
        fields = super()._load_pos_data_fields(config)
        if "stage_ids" not in fields:
            fields.append("stage_ids")
        return fields

