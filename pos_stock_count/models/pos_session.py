from odoo import api, models
from odoo.http import request

PRODUCT_CHANGE_KEY = "ab_stock_product_change"


class PosSession(models.Model):
    _inherit = "pos.session"

    @api.model
    def _load_pos_data_models(self, config):
        """Include ``stock.warehouse`` in the models loaded by POS session.

        :param recordset config: Active ``pos.config`` record.
        :return: List of model names to load in POS.
        :rtype: list[str]
        """
        data = super()._load_pos_data_models(config)
        if "stock.warehouse" not in data:
            data.append("stock.warehouse")
        return data

    @api.model
    def note_product_change(self, product_ids):
        """Accumulate changed ``product.product`` IDs in the active HTTP request context.

        :param list[int] product_ids: IDs of ``product.product`` records whose stock or config changed.
        """
        if not request or not product_ids:
            return
        try:
            ctx = request.env.context
        except RuntimeError:
            return
        cur_ids = ctx.get(PRODUCT_CHANGE_KEY, set())
        request.update_context(**{PRODUCT_CHANGE_KEY: set(product_ids).union(cur_ids)})

    @api.model
    def send_product_update_notification(self):
        """Broadcast ``POS_PRODUCT_CHANGE`` bus notifications to all open POS sessions."""
        if not request:
            return
        try:
            ctx = request.env.context
        except RuntimeError:
            return
        product_ids = list(ctx.get(PRODUCT_CHANGE_KEY, set()))
        if not product_ids:
            return
        products = self.env["product.product"].sudo().browse(product_ids).exists()
        product_tmpl_ids = products.mapped("product_tmpl_id").ids
        sessions = self.env["pos.session"].sudo().search([("state", "=", "opened")])
        for session in sessions:
            session.config_id._notify(
                "POS_PRODUCT_CHANGE",
                {
                    "product_ids": products.ids,
                    "product_tmpl_ids": product_tmpl_ids,
                },
            )
        request.update_context(**{PRODUCT_CHANGE_KEY: set()})
