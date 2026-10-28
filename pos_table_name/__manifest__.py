# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Table Name',
    'version': '20.0.1.0.0',
    'category': 'Sales/Point of Sale',
    'summary': 'Custom table names for POS Restaurant floor plans, orders, and receipts',
    'description': """
Adds a custom Table Name (Char) field to restaurant tables (`restaurant.table`)
in addition to the numeric Table Number:
- Backend floor and table form/list views and display_name computation
- POS Floor Plan screen and Floor Plan Editor sidebar
- POS Order header/navbar, Ticket Screen, Order Details dialog, and Split Bill naming
- POS Customer Receipt and Kitchen/Preparation Receipt
""",
    'depends': ['pos_restaurant'],
    'data': [
        'views/pos_restaurant_views.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_table_name/static/src/**/*',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
