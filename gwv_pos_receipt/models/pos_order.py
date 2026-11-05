# -*- coding: utf-8 -*-
from odoo import api, models


class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def _load_pos_data_domain(self, data):
        domain = super()._load_pos_data_domain(data)
        draft_orders = self.search(domain)
        for order in draft_orders:
            if not order.name or order.name == '/':
                order.name = order._compute_order_name()
        return domain

    @api.model_create_multi
    def create(self, vals_list):
        """Assign the pos.order sequence name immediately upon creation
        (even in draft state) so kitchen tickets and pre-bills display
        the official sequence (e.g. Restaurant/0003) before payment.
        """
        orders = super().create(vals_list)
        for order in orders:
            if not order.name or order.name == '/':
                order.name = order._compute_order_name()
        return orders

    def write(self, vals):
        """Ensure any existing draft order without a sequence name receives one,
        unless the order is being cancelled.
        """
        if vals.get('state') != 'cancel':
            for order in self:
                if (not order.name or order.name == '/') and not vals.get('name') and order.state != 'cancel':
                    vals['name'] = order._compute_order_name()
        return super().write(vals)
