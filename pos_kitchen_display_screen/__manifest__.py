{
    "name": "POS Kitchen Display Screen",
    "version": "1.0.0",
    "category": "Sales/Point of Sale",
    "summary": "Product image preview, completion tick box, table name, and real-time cashier preparation status",
    "description": """
POS Kitchen Display Screen Extensions
=====================================
Features:
- Adds a completion tick box in front of each order line item in the Kitchen Display Screen.
- Adds an image preview button to preview the product's image in a modal popup.
- Displays the custom table name from `pos_table_name` in the Kitchen Display Screen card header.
- Displays real-time preparation status badges ('Ready' and 'Served') with color indicators on POS cashier cart lines.
""",
    "author": "",
    "license": "LGPL-3",
    "depends": ["pos_enterprise", "pos_restaurant", "pos_table_name", "pos_self_order"],
    "data": [],
    "assets": {
        "pos_preparation_display.assets": [
            "pos_kitchen_display_screen/static/src/app/**/*",
        ],
        "point_of_sale._assets_pos": [
            "pos_kitchen_display_screen/static/src/pos/**/*",
        ],
        "pos_self_order.assets": [
            "pos_kitchen_display_screen/static/src/self_order/**/*",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
