# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    @api.model
    def _split_layout_server_data(self, data, model_keys, layout_exclude_keys):
        """Ensure ``table_name`` is persisted as a model field on ``restaurant.table`` rather than in layout JSON.

        Parameters:
            data (dict): Floor or table payload dictionary from the POS floor plan editor.
            model_keys (set[str] | Iterable[str]): Keys to extract as database model fields.
            layout_exclude_keys (set[str] | Iterable[str]): Keys to exclude from ``floor_plan_layout``.

        Returns:
            tuple[dict, dict]: ``(model_data, layout_data)`` dictionaries.

        Side effects:
            None
        """
        if 'table_number' in model_keys:
            model_keys = set(model_keys) | {'table_name'}
        return super()._split_layout_server_data(data, model_keys, layout_exclude_keys)
