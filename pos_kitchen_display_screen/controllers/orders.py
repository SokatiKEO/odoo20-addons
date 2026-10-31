from odoo import http
from odoo.addons.pos_self_order.controllers.orders import PosSelfOrderController


class PosKitchenSelfOrderController(PosSelfOrderController):
    """Extend self-order controller to sync preparation orders when customer scans table QR."""

    @http.route("/pos-self-order/get-user-data", auth="public", type="jsonrpc", website=True)
    def get_orders_by_access_token(self, access_token, order_access_tokens, table_identifier=None):
        """Retrieve customer orders and include active table orders in the current POS session.

        :param str access_token: POS config access token.
        :param list[dict] order_access_tokens: Tokens of orders already known by the client.
        :param str table_identifier: Unique table identifier when scanning a table QR code.
        :return: Dict containing serialized model records for pos.order and pos.order.line.
        :rtype: dict
        """
        pos_config = self._verify_pos_config(access_token)
        res = super().get_orders_by_access_token(access_token, order_access_tokens, table_identifier=table_identifier)

        if table_identifier and pos_config.has_active_session:
            table = pos_config.env["restaurant.table"].search([("identifier", "=", table_identifier)], limit=1)
            if table:
                session_orders = pos_config.env["pos.order"].search([
                    ("table_id", "=", table.id),
                    ("session_id", "=", pos_config.current_session_id.id),
                    ("state", "not in", ("cancel",)),
                ])
                if session_orders:
                    table_order_vals = self._generate_return_values(session_orders, pos_config)
                    if not res:
                        res = table_order_vals
                    else:
                        existing_order_ids = {o["id"] for o in res.get("pos.order", [])}
                        for o in table_order_vals.get("pos.order", []):
                            if o["id"] not in existing_order_ids:
                                res.setdefault("pos.order", []).append(o)

                        existing_line_ids = {l["id"] for l in res.get("pos.order.line", [])}
                        for l in table_order_vals.get("pos.order.line", []):
                            if l["id"] not in existing_line_ids:
                                res.setdefault("pos.order.line", []).append(l)

        return res

