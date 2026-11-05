# -*- coding: utf-8 -*-
{
    'name': 'GWV POS Order Receipt',
    'version': '18.0.1.0.0',
    'category': 'Point of Sale',
    'summary': 'Custom POS Order Receipt layout for Gold Wings Venture with multi-currency totals and company defaults',
    'description': """
GWV POS Order Receipt
=====================
Customizes the Point of Sale Order Receipt to match the standard Gold Wings Venture / Gelato receipt layout:
- Company branding (name, VAT TIN, address, phone, logo) with automatic fallback to company defaults
- Multi-currency display with KHR exchange rate and Grand Total in KHR & USD
- Itemized table with clean 4-column layout (Qty, Item Name, U.Price, Amount)
- Totals breakdown (Sub-Total, Discount, VAT breakdown, Grand Total KHR/USD)
- Bold Total Sales highlight and payment / change breakdown
- Customer signature line and customizable closing footer notes
- Fully configurable per POS shop in Point of Sale > Configuration > Settings
    """,
    'author': '',
    'website': '',
    'license': 'LGPL-3',
    'depends': [
        'point_of_sale',
    ],
    'data': [
        'views/pos_config_views.xml',
        'views/res_config_settings_views.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'gwv_pos_receipt/static/src/**/*',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
