from odoo import models


class PosConfig(models.Model):
    _inherit = "pos.config"

    def _get_kds_prep_displays(self):
        """Return the preparation displays serving this POS configuration.

        Mirrors the domain used by ``pos_enterprise`` when loading
        ``pos.prep.display`` into the POS: displays without any POS restriction
        serve every configuration.

        :return: ``pos.prep.display`` recordset.
        """
        self.ensure_one()
        return self.env["pos.prep.display"].search([
            "|",
            ("pos_config_ids", "=", False),
            ("pos_config_ids", "in", self.ids),
        ])

    def _get_kds_prep_stages(self):
        """Return the preparation stages of this configuration's kitchen displays.

        :return: ``pos.prep.stage`` recordset ordered by sequence.
        """
        self.ensure_one()
        return self._get_kds_prep_displays().stage_ids.sorted(key=lambda s: (s.sequence, s.id))

