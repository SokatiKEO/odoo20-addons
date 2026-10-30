{
    "name": "POS Kitchen Display Screen",
    "version": "1.0.0",
    "category": "Sales/Point of Sale",
    "summary": "Product image preview, completion tick box, and table name for Kitchen Display Screen",
    "description": """
POS Kitchen Display Screen Extensions
====================================
Features:
- Adds a completion tick box in front of each order line item in the Kitchen Display Screen.
- Adds an image preview button to preview the product's image in a modal popup.
- Displays the custom table name from `pos_table_name` in the Kitchen Display Screen card header.
""",
    "author": "Antigravity",
    "license": "OEEL-1",
    "depends": ["pos_enterprise", "pos_restaurant", "pos_table_name"],
    "data": [],
    "assets": {
        "pos_preparation_display.assets": [
            "pos_kitchen_display_screen/static/src/app/**/*",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
