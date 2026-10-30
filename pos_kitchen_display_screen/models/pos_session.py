from odoo import api, models


class PosSession(models.Model):
    _inherit = "pos.session"

    @api.model
    def _load_pos_data_models(self, config_id):
        """Ensure pos.prep.stage is loaded into POS session memory so stages are dynamically available."""
        models_list = super()._load_pos_data_models(config_id)
        if "pos.prep.stage" not in models_list:
            models_list.append("pos.prep.stage")
        return models_list

