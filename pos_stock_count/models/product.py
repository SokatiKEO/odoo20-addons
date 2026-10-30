from odoo import api, fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    ab_stock_out_of_stock = fields.Boolean(string="Continous Selling")
    ab_stock_deny = fields.Selection(
        [
            ("default", "Use default (PoS configuration)"),
            ("always", "Always"),
            ("never", "Never"),
        ],
        string="Deny Order",
        default="default",
        required=True,
    )
    ab_stock_deny_qty = fields.Integer(default=0, string="Deny Order Quantity")
    ab_stock_warehouses = fields.Json(compute="_compute_ab_stock_warehouses")

    @api.model
    def load_pos_data_force_loading(self):
        """Force loading product templates from server so stock counts are never stale."""
        return True

    @api.depends("qty_available", "free_qty", "virtual_available")
    def _compute_ab_stock_warehouses(self):
        warehouses = self.env["stock.warehouse"].search(
            self.env["stock.warehouse"]._check_company_domain(self.env.company)
        )
        for template in self:
            if not template.is_storable:
                template.ab_stock_warehouses = {}
                continue
            warehouse_dict = {}
            for w in warehouses:
                tmpl_wh = template.with_context(warehouse_id=w.id)
                free_qty = sum(
                    template.product_variant_ids.with_context(warehouse_id=w.id).mapped(
                        "free_qty"
                    )
                )
                warehouse_dict[w.id] = {
                    "id": w.id,
                    "qty_available": tmpl_wh.qty_available,
                    "free_qty": free_qty,
                    "virtual_available": tmpl_wh.virtual_available,
                }
            template.ab_stock_warehouses = warehouse_dict

    @api.model
    def _load_pos_data_fields(self, config):
        """Append stock display and validation fields to POS product template data.

        :param recordset config: Active ``pos.config`` record.
        :return: List of ``product.template`` field names to load in POS.
        :rtype: list[str]
        """
        field_names = super()._load_pos_data_fields(config)
        for fname in (
            "is_storable",
            "ab_stock_warehouses",
            "ab_stock_out_of_stock",
            "ab_stock_deny",
            "ab_stock_deny_qty",
        ):
            if fname not in field_names:
                field_names.append(fname)
        return field_names

    @api.model_create_multi
    def create(self, vals_list):
        """Create product templates and notify active POS sessions of changes.

        :param list[dict] vals_list: List of field dictionaries for creation.
        :return: Created ``product.template`` recordset.
        :rtype: recordset
        """
        res = super().create(vals_list)
        res.note_change()
        return res

    def write(self, vals):
        """Update product templates and notify active POS sessions of changes.

        :param dict vals: Updated field values.
        :return: True if write succeeded.
        :rtype: bool
        """
        res = super().write(vals)
        self.note_change()
        return res

    def note_change(self):
        """Record modified product variants in request context for POS bus sync."""
        self.product_variant_ids.note_change()


class ProductProduct(models.Model):
    _inherit = "product.product"

    ab_stock_warehouses = fields.Json(compute="_compute_ab_stock_warehouses")

    @api.model
    def load_pos_data_force_loading(self):
        """Force loading product variants from server so stock counts are never stale."""
        return True

    @api.depends("qty_available", "free_qty", "virtual_available")
    def _compute_ab_stock_warehouses(self):
        warehouses = self.env["stock.warehouse"].search(
            self.env["stock.warehouse"]._check_company_domain(self.env.company)
        )
        for product in self:
            if not product.is_storable:
                product.ab_stock_warehouses = {}
                continue
            warehouse_dict = {}
            for w in warehouses:
                prod_wh = product.with_context(warehouse_id=w.id)
                warehouse_dict[w.id] = {
                    "id": w.id,
                    "qty_available": prod_wh.qty_available,
                    "free_qty": prod_wh.free_qty,
                    "virtual_available": prod_wh.virtual_available,
                }
            product.ab_stock_warehouses = warehouse_dict

    @api.model
    def _load_pos_data_fields(self, config):
        """Append stock display and validation fields to POS product variant data.

        :param recordset config: Active ``pos.config`` record.
        :return: List of ``product.product`` field names to load in POS.
        :rtype: list[str]
        """
        field_names = super()._load_pos_data_fields(config)
        for fname in (
            "is_storable",
            "ab_stock_warehouses",
            "ab_stock_out_of_stock",
            "ab_stock_deny",
            "ab_stock_deny_qty",
        ):
            if fname not in field_names:
                field_names.append(fname)
        return field_names

    @api.model_create_multi
    def create(self, vals_list):
        """Create product variants and notify active POS sessions of changes.

        :param list[dict] vals_list: List of field dictionaries for creation.
        :return: Created ``product.product`` recordset.
        :rtype: recordset
        """
        res = super().create(vals_list)
        res.note_change()
        return res

    def write(self, vals):
        """Update product variants and notify active POS sessions of changes.

        :param dict vals: Updated field values.
        :return: True if write succeeded.
        :rtype: bool
        """
        res = super().write(vals)
        self.note_change()
        return res

    def note_change(self):
        """Record modified product IDs in request context for POS bus sync."""
        if self.ids:
            self.env["pos.session"].note_product_change(self.ids)
