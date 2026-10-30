from odoo import api, models


class AbStockDemo(models.TransientModel):
    _name = "ab.stock.demo"
    _description = "POS Stock Demo Setup"

    @api.model
    def init_pos_Configs(self):
        """Initialize demo POS configurations with warehouse stock display settings."""
        shop_wh = self.env.ref("stock.warehouse0", raise_if_not_found=False)
        shop_config = self.env.ref(
            "point_of_sale.pos_config_clothes", raise_if_not_found=False
        )
        if shop_config and shop_wh:
            shop_config.write(
                {
                    "ab_stock_allow_select_wh": True,
                    "ab_stock_warehouse_ids": [shop_wh.id],
                    "ab_stock_show_Substitutes": True,
                    "ab_stock_deny": True,
                }
            )
        restaurant_config = self.env.ref(
            "pos_restaurant.pos_config_main_restaurant", raise_if_not_found=False
        )
        if restaurant_config:
            restaurant_config.write(
                {
                    "ab_stock_display": False,
                }
            )
