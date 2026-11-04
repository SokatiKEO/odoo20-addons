{
    "name": "POS Preparation Screen Manager",
    "version": "1.0.0",
    "category": "Sales/Point of Sale",
    "summary": "Read-only, mobile-compatible multi-screen manager dashboard for POS Preparation Displays",
    "description": """
POS Preparation Screen Manager
==============================
Provides a read-only, mobile-compatible Manager Preparation Screen that displays
exact live views of multiple POS Preparation Displays simultaneously or via tabs.

Features:
- Configure Manager Preparation Screens with any number of Preparation Displays (`pos.prep.display`).
- Strictly read-only mode: prevents stage changes, item toggling, order clearing, recall, and duplicate auto-printing.
- Multi-screen Split Grid view (side-by-side or stacked) and instant Tabbed switcher view.
- Dynamic screen selector in the UI to add or toggle preparation screens at any time.
- Mobile-compatible responsive layout for phones, tablets, and desktops.
""",
    "author": "",
    "license": "LGPL-3",
    "depends": [
        "point_of_sale",
        "pos_enterprise",
    ],
    "data": [
        "security/ir.access.csv",
        "views/pos_prep_screen_manager_views.xml",
        # "views/pos_prep_display_views.xml",
        "views/manager_screen_index.xml",
    ],
    "assets": {
        "pos_preparation_display.assets": [
            "pos_preparation_screen_manager/static/src/app/**/*",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
