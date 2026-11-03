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

        # 1. Active orders tracked by customer access tokens
        tokens = [d["access_token"] for d in order_access_tokens if d.get("access_token")]
        token_orders = pos_config.env["pos.order"].search([
            ("access_token", "in", tokens),
            ("state", "not in", ("cancel",)),
        ]) if tokens else pos_config.env["pos.order"]

        # 2. Active orders on the scanned table
        table_orders = pos_config.env["pos.order"]
        if table_identifier:
            table = pos_config.env["restaurant.table"].search([("identifier", "=", table_identifier)], limit=1)
            if table:
                table_orders = pos_config.env["pos.order"].search([
                    ("table_id", "=", table.id),
                    ("state", "not in", ("cancel",)),
                ])

        # 3. Orders matched by super
        super_order_ids = [o["id"] for o in res.get("pos.order", [])] if res and res.get("pos.order") else []
        super_orders = pos_config.env["pos.order"].browse(super_order_ids) if super_order_ids else pos_config.env["pos.order"]

        all_orders = token_orders | table_orders | super_orders
        if all_orders:
            fresh_vals = self._generate_return_values(all_orders, pos_config)
            if not res:
                return fresh_vals
            # Overwrite res with fresh records to guarantee latest preparation stages and fields
            for model_key, fresh_records in fresh_vals.items():
                if not isinstance(fresh_records, list):
                    res[model_key] = fresh_records
                    continue
                existing_map = {
                    r["id"]: i
                    for i, r in enumerate(res.get(model_key, []))
                    if isinstance(r, dict) and "id" in r
                }
                for r in fresh_records:
                    r_id = r.get("id")
                    if r_id in existing_map:
                        res[model_key][existing_map[r_id]] = r
                    else:
                        res.setdefault(model_key, []).append(r)
            return res

        return res
