from odoo import http
from odoo.addons.pos_self_order.controllers.orders import PosSelfOrderController


class PosKitchenSelfOrderController(PosSelfOrderController):
    """Extend self-order controller to sync preparation orders in real-time."""

    @http.route("/pos-self-order/get-user-data", auth="public", type="jsonrpc", website=True)
    def get_orders_by_access_token(self, access_token, order_access_tokens, table_identifier=None):
        """Retrieve customer orders and include active orders and table orders in real-time.

        :param str access_token: POS config access token.
        :param list[dict] order_access_tokens: Tokens of orders already known by the client.
        :param str table_identifier: Unique table identifier when scanning a table QR code.
        :return: Dict containing serialized model records for pos.order and pos.order.line.
        :rtype: dict
        """
        pos_config = self._verify_pos_config(access_token)
        res = super().get_orders_by_access_token(access_token, order_access_tokens, table_identifier=table_identifier)

        # 1. Always return fresh preparation status for active orders tracked by the customer client
        tokens = [d["access_token"] for d in order_access_tokens if d.get("access_token")]
        if tokens:
            customer_orders = pos_config.env["pos.order"].search([
                ("access_token", "in", tokens),
                ("state", "not in", ("cancel",)),
            ])
            if customer_orders:
                customer_vals = self._generate_return_values(customer_orders, pos_config)
                if not res:
                    res = customer_vals
                else:
                    existing_order_ids = {o["id"] for o in res.get("pos.order", [])}
                    for o in customer_vals.get("pos.order", []):
                        if o["id"] not in existing_order_ids:
                            res.setdefault("pos.order", []).append(o)

                    existing_line_ids = {l["id"] for l in res.get("pos.order.line", [])}
                    for l in customer_vals.get("pos.order.line", []):
                        if l["id"] not in existing_line_ids:
                            res.setdefault("pos.order.line", []).append(l)

        # 2. Also include session orders for the scanned table
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
