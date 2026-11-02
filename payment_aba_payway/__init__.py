from . import controllers
from . import models
from . import wizards


from odoo.addons.payment import setup_provider, reset_payment_provider


def post_init_hook(env):
    setup_provider(env, "aba_payway")
    providers = env["payment.provider"].search([("code", "=", "aba_payway")])
    generic_view = env.ref("payment.generic_redirect_form", raise_if_not_found=False)
    if generic_view and providers:
        providers.filtered(lambda p: not p.redirect_form_view_id).redirect_form_view_id = generic_view.id


def uninstall_hook(env):
    reset_payment_provider(env, "aba_payway")
