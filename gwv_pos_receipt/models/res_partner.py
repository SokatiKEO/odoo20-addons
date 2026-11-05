# -*- coding: utf-8 -*-
from odoo import api, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.model
    def _load_pos_data_domain(self, data):
        """Include the configured default POS customer in loaded POS partners.

        :param dict data: Loaded POS data dictionary containing pos.config data.
        :return list: Domain filter for loading partner records in POS.
        """
        domain = super()._load_pos_data_domain(data)
        config_id = self.env['pos.config'].browse(data['pos.config']['data'][0]['id'])
        if config_id.default_partner_id:
            new_domain = []
            for leaf in domain:
                if isinstance(leaf, (list, tuple)) and len(leaf) == 3 and leaf[0] == 'id' and leaf[1] == 'in':
                    ids = set(leaf[2])
                    ids.add(config_id.default_partner_id.id)
                    new_domain.append(('id', 'in', list(ids)))
                else:
                    new_domain.append(leaf)
            return new_domain
        return domain
