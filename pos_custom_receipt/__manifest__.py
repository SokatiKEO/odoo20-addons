{
    "name": "POS Custom Order Receipt",
    "version": "20.0.1.0.0",
    "category": "Sales/Point of Sale",
    "summary": "Custom POS Order Receipt layout with multi-currency (USD/KHR) totals and company branding",
    "description": """
POS Custom Order Receipt
========================
Customizes the Point of Sale Order Receipt in Odoo 20:
- Company branding (name, VAT TIN, address, phone, custom logo) with automatic fallback to company defaults
- Multi-currency display with KHR exchange rate and Grand Total in KHR & USD
- Itemized 4-column table layout (Item Name, Qty, U.Price, Amount)
- Totals breakdown (Sub-Total, Discount, Grand Total KHR/USD, Total Sales)
- Payment and change breakdown in KHR & USD
- Optional customer signature line and customizable closing footer note
- Configurable per POS shop in Point of Sale > Configuration > Settings
""",
    "author": "",
    "license": "LGPL-3",
    "depends": [
        "point_of_sale",
    ],
    "data": [
        "views/pos_config_views.xml",
        "views/res_config_settings_views.xml",
        "receipt/pos_order_receipt.xml",
    ],
    "assets": {
        "point_of_sale._assets_pos": [
            "pos_custom_receipt/static/src/**/*",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
