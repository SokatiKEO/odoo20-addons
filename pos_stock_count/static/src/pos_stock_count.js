import { Component, proxy, t, useProps, xml } from "@odoo/owl";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";
import { parseFloat } from "@web/views/fields/parsers";
import { patch } from "@web/core/utils/patch";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { Navbar } from "@point_of_sale/app/components/navbar/navbar";
import { ProductCard } from "@point_of_sale/app/components/product_card/product_card";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { ProductProduct } from "@point_of_sale/app/models/product_product";
import { PosStore } from "@point_of_sale/app/services/pos_store";

// Temporary line being merged by ``PosOrderline.merge``: it is still part of
// ``order.lines`` while the target line's quantity is updated.
let mergingOrderline = null;

export class Stock {
    constructor(pos) {
        this.pos = pos;
        this.state = proxy({
            selectedWarehouse: this.defaultWarehouse,
            version: 0,
        });
    }

    get models() {
        return this.pos.models;
    }

    get defaultWarehouse() {
        const rawWh = this.pos.config?.warehouse_id;
        const id = rawWh?.id ?? rawWh;
        return id ? this.models["stock.warehouse"]?.get(id) : undefined;
    }

    get selectedWarehouse() {
        return this.state.selectedWarehouse || this.defaultWarehouse;
    }

    selectWarehouse(warehouse) {
        this.state.selectedWarehouse =
            typeof warehouse === "number"
                ? this.models["stock.warehouse"]?.get(warehouse)
                : warehouse;
    }

    /**
     * ``product.product`` records transparently expose every ``product.template``
     * field (``enhanceProductTemplate``), so duck-typing on ``product_variant_ids``
     * cannot tell a variant from a template. Rely on the record class instead.
     *
     * @param {Object} product ``product.product`` or ``product.template`` record
     * @returns {boolean} true when ``product`` is a ``product.product`` record
     */
    isVariant(product) {
        return product instanceof ProductProduct;
    }

    getStock(product, warehouseId) {
        // Subscribe to reactive version counter for backend bus updates
        void this.state.version;
        warehouseId = warehouseId || this.selectedWarehouse?.id;
        if (!product || !warehouseId) {
            return undefined;
        }
        // A variant only owns its own stock: never aggregate its siblings
        if (this.isVariant(product)) {
            const variantStock =
                product.ab_stock_warehouses?.[warehouseId] ??
                product.ab_stock_warehouses?.[String(warehouseId)];
            const tmpl = product.product_tmpl_id;
            // Template data is only equivalent to the variant's for single-variant templates
            if (variantStock || (tmpl?.product_variant_ids?.length || 0) > 1) {
                return variantStock;
            }
            return (
                tmpl?.ab_stock_warehouses?.[warehouseId] ??
                tmpl?.ab_stock_warehouses?.[String(warehouseId)]
            );
        }
        // Template: aggregate the stock of all its variants
        if (product.product_variant_ids?.length) {
            let hasStock = false;
            const agg = {
                id: warehouseId,
                qty_available: 0,
                free_qty: 0,
                virtual_available: 0,
            };
            for (const variant of product.product_variant_ids) {
                const whData =
                    variant.ab_stock_warehouses?.[warehouseId] ??
                    variant.ab_stock_warehouses?.[String(warehouseId)];
                if (whData) {
                    hasStock = true;
                    agg.qty_available += whData.qty_available || 0;
                    agg.free_qty += whData.free_qty || 0;
                    agg.virtual_available += whData.virtual_available || 0;
                }
            }
            if (hasStock) {
                return agg;
            }
        }
        const directStock =
            product.ab_stock_warehouses?.[warehouseId] ??
            product.ab_stock_warehouses?.[String(warehouseId)];
        if (directStock) {
            return directStock;
        }
        const tmpl = product.product_tmpl_id;
        return (
            tmpl?.ab_stock_warehouses?.[warehouseId] ??
            tmpl?.ab_stock_warehouses?.[String(warehouseId)]
        );
    }

    /**
     * @param {Object} product ``product.product`` or ``product.template`` record
     * @param {number} [warehouseId] defaults to the selected warehouse
     * @returns {number} on-hand quantity (per ``ab_stock_qty_type``), cart excluded
     */
    getAvailableStock(product, warehouseId) {
        warehouseId = warehouseId || this.selectedWarehouse?.id;
        const stock = this.getStock(product, warehouseId);
        const qtyType = this.pos.config?.ab_stock_qty_type || "free_qty";
        return stock ? stock[qtyType] || 0 : 0;
    }

    /**
     * Sum the quantities of the order lines consuming ``product`` in ``warehouseId``.
     *
     * @param {Object} product ``product.product`` or ``product.template`` record
     * @param {number} [warehouseId] defaults to the selected warehouse
     * @param {Object} [options]
     * @param {Object} [options.order] order to inspect, defaults to the current order
     * @param {Object[]} [options.excludeLines] lines to ignore (e.g. the line being edited)
     * @returns {number} quantity already in the order
     */
    getOrderedQty(product, warehouseId, { order, excludeLines = [] } = {}) {
        warehouseId = warehouseId || this.selectedWarehouse?.id;
        order = order || this.pos.getOrder();
        if (!product || !order?.lines) {
            return 0;
        }
        const isVariant = this.isVariant(product);
        const defaultWhId = this.defaultWarehouse?.id;
        // Compare by uuid: lines may be reached through reactive proxies, breaking identity
        const excludedUuids = new Set(excludeLines.map((line) => line?.uuid).filter(Boolean));
        return order.lines
            .filter((line) => {
                if (excludedUuids.has(line.uuid)) {
                    return false;
                }
                const matchesProduct = isVariant
                    ? line.product_id?.id === product.id
                    : line.product_id?.product_tmpl_id?.id === product.id;
                if (!matchesProduct) {
                    return false;
                }
                const lineWhId = line.ab_warehouse_id?.id ?? line.ab_warehouse_id;
                return lineWhId === warehouseId || (!lineWhId && warehouseId === defaultWhId);
            })
            .reduce((acc, line) => acc + (line.qty || 0), 0);
    }

    getQty(product, warehouseId) {
        return this.getAvailableStock(product, warehouseId) - this.getOrderedQty(product, warehouseId);
    }

    getSubstituteWarehouses(product) {
        const res = [];
        for (const wh of this.pos.config.ab_stock_warehouse_ids || []) {
            const whId = wh?.id ?? wh;
            const warehouse =
                typeof wh === "object" ? wh : this.models["stock.warehouse"]?.get(whId);
            if (warehouse && this.getQty(product, warehouse.id) > 0) {
                res.push(warehouse);
            }
        }
        return res;
    }

    isStorable(product) {
        const tmpl = product?.product_tmpl_id || product;
        return Boolean(product?.is_storable ?? tmpl?.is_storable);
    }

    showProductOverlay(product) {
        return Boolean(this.pos.config?.ab_stock_display && this.isStorable(product));
    }

    /**
     * @param {Object} product ``product.product`` or ``product.template`` record
     * @returns {number|null} minimum remaining stock to keep, or null when not restricted
     */
    getDenyThreshold(product) {
        const tmpl = product?.product_tmpl_id || product;
        const isOutOfStockAllowed = Boolean(
            product?.ab_stock_out_of_stock ?? tmpl?.ab_stock_out_of_stock
        );
        if (!this.isStorable(product) || isOutOfStockAllowed) {
            return null;
        }
        const denyMode = product?.ab_stock_deny || tmpl?.ab_stock_deny || "default";
        if (denyMode === "never") {
            return null;
        }
        if (denyMode === "always") {
            return product?.ab_stock_deny_qty ?? tmpl?.ab_stock_deny_qty ?? 0;
        }
        // Default mode: enforce stock limit when ab_stock_deny is enabled (or stock display is active)
        return this.pos.config?.ab_stock_deny_qty ?? 0;
    }

    /**
     * Check whether adding ``qty`` units of ``product`` would break the stock limit.
     *
     * @param {Object} product ``product.product`` or ``product.template`` record
     * @param {number} [qty=0] quantity to add on top of the (non-excluded) order lines
     * @param {number} [warehouseId] defaults to the selected warehouse
     * @param {Object} [options] forwarded to :meth:`getOrderedQty`
     * @returns {boolean} true when the order must be refused
     */
    denyOrder(product, qty = 0, warehouseId = undefined, options = {}) {
        const threshold = this.getDenyThreshold(product);
        if (threshold === null) {
            return false;
        }
        const remaining =
            this.getAvailableStock(product, warehouseId) -
            this.getOrderedQty(product, warehouseId, options) -
            qty;
        return remaining < threshold;
    }

    getDenyError(product, warehouseId = undefined) {
        const wh = warehouseId
            ? this.models["stock.warehouse"]?.get(warehouseId)
            : this.selectedWarehouse;
        const productName = product?.display_name || product?.name || "";
        const title = _t("%s is Out Of Stock", productName);
        let body = _t("Wait until %s is back in Stock.", productName);
        if (wh && this.pos.config?.ab_stock_allow_select_wh) {
            body += ` ${_t("Selected warehouse is")} ${wh.name} (${wh.code})`;
        }
        return { title, body };
    }

    showDenyPopup(product, warehouseId = undefined) {
        this.pos.dialog.add(AlertDialog, this.getDenyError(product, warehouseId));
    }
}

export class ProductStockWidget extends Component {
    static template = xml`
        <div t-if="this.visible" t-attf-class="position-absolute {{this.positionClass}} m-1 d-flex">
            <div t-attf-class="badge {{this.badgeClass}} rounded" t-esc="this.qty" />
            <div t-foreach="this.substitutes" t-as="warehouse" t-key="warehouse.id"
                style="margin-left: 0.125rem;"
                class="badge text-bg-success rounded"
                t-esc="warehouse.code"
            />
        </div>
    `;
    props = useProps({
        product: t.object(),
    });

    setup() {
        this.pos = usePos();
    }

    get stock() {
        return this.pos.stock;
    }

    get visible() {
        return Boolean(this.stock && this.stock.showProductOverlay(this.props.product));
    }

    get qty() {
        return this.stock.getQty(this.props.product);
    }

    get substitutes() {
        if (!this.pos.config.ab_stock_show_Substitutes || this.qty > 0) {
            return [];
        }
        return this.stock.getSubstituteWarehouses(this.props.product);
    }

    get badgeClass() {
        const qty = this.qty;
        if (qty <= 0) {
            return "text-bg-danger";
        }
        if (qty <= this.pos.config.ab_stock_low_stock) {
            return "text-bg-warning";
        }
        return "text-bg-success";
    }

    get positionClass() {
        switch (this.pos.config.ab_stock_position) {
            case "top-right":
                return "top-0 end-0";
            case "bottom-left":
                return "bottom-0 start-0";
            default:
                return "top-0 start-0";
        }
    }
}

ProductCard.components = {
    ...ProductCard.components,
    ProductStockWidget,
};

Navbar.components = {
    ...Navbar.components,
    Dropdown,
    DropdownItem,
};

patch(Navbar.prototype, {
    get stock() {
        return this.pos.stock;
    },
    get showWhButton() {
        return Boolean(
            this.pos.config?.ab_stock_allow_select_wh && this.selectedWh && this.abStockWarehouses.length > 0
        );
    },
    get selectedWh() {
        return this.stock?.selectedWarehouse;
    },
    get abStockWarehouses() {
        if (!this.stock) {
            return [];
        }
        const defaultWh = this.stock.defaultWarehouse;
        const whIds = new Set(
            (this.pos.config.ab_stock_warehouse_ids || []).map((wh) => wh?.id ?? wh)
        );
        if (defaultWh) {
            whIds.add(defaultWh.id);
        }
        return Array.from(whIds)
            .map((id) => this.pos.models["stock.warehouse"]?.get(id))
            .filter(Boolean);
    },
    onWarehouseButtonClick(warehouse) {
        this.stock.selectWarehouse(warehouse);
    },
});

patch(PosOrderline.prototype, {
    setQuantity(quantity, keep_price) {
        const quant =
            typeof quantity === "number" ? quantity : parseFloat("" + (quantity ? quantity : 0));
        const prevQty = this.qty || 0;
        // Only increases of a regular sale line can exceed stock; returns are negated by super
        const isIncrease =
            quant > 0 && quant > prevQty && !this.order_id?.preset_id?.is_return;
        if (isIncrease && this.order_id && this.stock) {
            const lineWhId = this.ab_warehouse_id?.id ?? this.ab_warehouse_id;
            // ``quant`` is this line's new total; while merging it already includes the
            // temporary line still present in ``order.lines``, so both are excluded.
            const excludeLines = mergingOrderline ? [this, mergingOrderline] : [this];
            const denied = this.stock.denyOrder(this.product_id, quant, lineWhId, {
                order: this.order_id,
                excludeLines,
            });
            if (denied) {
                return this.stock.getDenyError(this.product_id, lineWhId);
            }
        }
        return super.setQuantity(quantity, keep_price);
    },

    merge(orderline) {
        mergingOrderline = orderline;
        try {
            return super.merge(orderline);
        } finally {
            mergingOrderline = null;
        }
    },

    canBeMergedWith(orderline) {
        const thisWhId = this.ab_warehouse_id?.id ?? this.ab_warehouse_id;
        const otherWhId = orderline.ab_warehouse_id?.id ?? orderline.ab_warehouse_id;
        return super.canBeMergedWith(orderline) && thisWhId === otherWhId;
    },

    get orderDisplayProductName() {
        const res = super.orderDisplayProductName;
        const warehouseId = this.ab_warehouse_id?.id ?? this.ab_warehouse_id;
        if (warehouseId && warehouseId !== this.stock?.defaultWarehouse?.id) {
            const warehouse =
                typeof this.ab_warehouse_id === "object"
                    ? this.ab_warehouse_id
                    : this.models["stock.warehouse"]?.get(warehouseId);
            if (warehouse?.code) {
                return {
                    ...res,
                    name: `${res.name} (${warehouse.code})`,
                };
            }
        }
        return res;
    },
});

patch(PosStore.prototype, {
    async processServerData() {
        await super.processServerData();
        this.stock = new Stock(this);
        PosOrderline.prototype.stock = this.stock;
        this.data.connectWebSocket("POS_PRODUCT_CHANGE", this.onPosProductChange.bind(this));
        // Ensure products cached in IndexedDB before module install have stock data loaded
        const missingTmplIds = this.models["product.template"]
            .filter((t) => t.is_storable && !t.ab_stock_warehouses)
            .map((t) => t.id);
        const missingProdIds = this.models["product.product"]
            .filter((p) => (p.is_storable ?? p.product_tmpl_id?.is_storable) && !p.ab_stock_warehouses)
            .map((p) => p.id);
        if (missingTmplIds.length || missingProdIds.length) {
            await this.onPosProductChange({
                product_ids: missingProdIds,
                product_tmpl_ids: missingTmplIds,
            });
        }
    },

    async onPosProductChange({ product_ids, product_tmpl_ids }) {
        const stockFields = [
            "is_storable",
            "ab_stock_warehouses",
            "ab_stock_out_of_stock",
            "ab_stock_deny",
            "ab_stock_deny_qty",
        ];
        if (product_ids?.length) {
            await this.data.read("product.product", product_ids, stockFields);
        }
        if (product_tmpl_ids?.length) {
            await this.data.read("product.template", product_tmpl_ids, stockFields);
        }
        if (this.stock) {
            this.stock.state.version++;
        }
    },

    async handleOrderLineConfiguration(order, values, code, vals, options, configure) {
        const res = await super.handleOrderLineConfiguration(...arguments);
        if (!res) {
            return res;
        }
        const product = values.product_id;
        if (product && this.stock) {
            if (this.config.ab_stock_allow_select_wh && this.stock.isStorable(product)) {
                const selectedWh = this.stock.selectedWarehouse;
                if (selectedWh) {
                    values.ab_warehouse_id = selectedWh.id;
                }
            }
            const addedQty = values.qty ?? 1;
            const targetWhId = values.ab_warehouse_id?.id ?? values.ab_warehouse_id;
            // Stock exhausted: block the line and tell the cashier why
            if (addedQty > 0 && this.stock.denyOrder(product, addedQty, targetWhId, { order })) {
                this.stock.showDenyPopup(product, targetWhId);
                return false;
            }
        }
        return res;
    },
});

patch(ProductScreen.prototype, {
    getNumpadButtons() {
        const buttons = super.getNumpadButtons();
        const decimalPoint = this.env.services.localization.decimalPoint;
        return buttons.map((button) => {
            if (button.value === decimalPoint && this.pos.numpadMode === "quantity") {
                return { ...button, disabled: true };
            }
            return button;
        });
    },
});
