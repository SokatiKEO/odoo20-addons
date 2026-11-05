{
    "name": "POS Product Khmer Name",
    "version": "1.0.0",
    "category": "Sales/Point of Sale",
    "summary": "Add Khmer Name field on products and optionally display it in POS, Kitchen Display, and Customer Self-Order",
    "description": """
POS Product Khmer Name
======================
- Adds a 'Khmer Name' (khmer_name) field on product.template and product.product under the product Name.
- Adds a 'Show Product Khmer Name' setting on POS Configuration (pos.config / res.config.settings).
- When enabled and a product has a Khmer Name, displays the Khmer Name across:
  * Point of Sale (Product Cards, Cart Orderlines, Combo Configurator, Receipts, Search)
  * Kitchen Display Screen (Orderline product name, Image Preview dialog, Sidebar Category product list)
  * Customer Self-Order (Product Cards, Product Detail page, Combo Selection page, Cart page, Product Info popup)
""",
    "author": "",
    "license": "LGPL-3",
    "depends": [
        "point_of_sale",
        "pos_enterprise",
        "pos_kitchen_display_screen",
        "pos_self_order",
    ],
    "data": [
        "views/product_views.xml",
        "views/res_config_settings_views.xml",
    ],
    "assets": {
        "point_of_sale._assets_pos": [
            "pos_product_khmer_name/static/src/pos/**/*",
        ],
        "pos_preparation_display.assets": [
            "pos_product_khmer_name/static/src/kds/**/*",
        ],
        "pos_self_order.assets": [
            "pos_product_khmer_name/static/src/self_order/**/*",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}

