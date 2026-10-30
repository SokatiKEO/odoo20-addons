{
    "name": "POS Stock Count",
    "summary": "Display stocks inside the POS, validate quantities, choose warehouse and more",
    "description": """
POS Stock
=========

Enhance your Odoo Point of Sale experience with advanced stock management capabilities:

* **Real-Time Stock Display**: View current stock levels directly within the POS interface.
* **Choose Warehouse**: Select different warehouses for stock deduction right from the POS.
* **Stock Validation**: Prevent sales of out-of-stock items by validating product quantities during order creation.
    """,
    "author": "Andreas Bichinger",
    "category": "Sales/Point of Sale",
    "version": "20.0.1.0.1",
    "license": "OPL-1",
    "price": 32,
    "currency": "EUR",
    "depends": ["point_of_sale", "pos_stock"],
    "data": [
        "security/ir.access.csv",
        "views/res_config_settings.xml",
        "views/product_view.xml",
    ],
    "demo": [
        "demo/demo.xml",
    ],
    "assets": {
        "point_of_sale._assets_pos": [
            "pos_stock_count/static/src/**/*",
        ],
    },
    "images": [
        "static/description/banner.png",
    ],
    "installable": True,
    "application": False,
}
