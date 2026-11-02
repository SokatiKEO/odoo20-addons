from odoo import api, models


class PosSession(models.Model):
    _inherit = "pos.session"

    @api.model
    def _load_pos_data_models(self, config_id):
        """Ensure pos.prep.stage and pos.prep.display are loaded into POS session memory."""
        models_list = super()._load_pos_data_models(config_id)
        for model_name in ("pos.prep.display", "pos.prep.stage"):
            if model_name not in models_list:
                models_list.append(model_name)
        return models_list
