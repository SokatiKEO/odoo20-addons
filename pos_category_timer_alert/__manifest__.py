{
    "name": "pos_category_timer_alert",
    "version": "1.0.0",
    "category": "Sales/Point of Sale",
    "summary": "Category-based alert timer and persistent order duration across stages in Kitchen Display",
    "description": """
POS Category Alert Timer & Persistent Duration
==============================================
- Configures preparation alert timer on POS Category (pos.category).
- Prevents KDS order header timer from resetting after each stage change.
- Highlights individual overdue items in the kitchen view when their preparation exceeds their category timer.
- Order card enters alert state if any active line has breached its category preparation threshold.
""",
    "author": "SMG",
    "license": "LGPL-3",
    "depends": ["point_of_sale", "pos_enterprise", "pos_kitchen_display_screen"],
    "data": [
        "views/pos_category_views.xml",
    ],
    "assets": {
        "pos_preparation_display.assets": [
            "pos_category_timer_alert/static/src/app/**/*",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
