import { patch } from "@web/core/utils/patch";
import { SelfOrder } from "@pos_self_order/app/services/self_order_service";
import { ProductCard } from "@pos_self_order/app/components/product_card/product_card";
import { ProductPage } from "@pos_self_order/app/pages/product_page/product_page";
import { CartPage } from "@pos_self_order/app/pages/cart_page/cart_page";
import { getProductVariantByAttributes } from "@pos_self_order/app/services/card_utils";

patch(SelfOrder.prototype, {
    isStorable(product) {
        const tmpl = product?.product_tmpl_id || product;
        return Boolean(product?.is_storable ?? tmpl?.is_storable);
    },

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
        const configDeny = this.config?.ab_stock_deny !== false;
        if (!configDeny) {
            return null;
        }
        return this.config?.ab_stock_deny_qty ?? 0;
    },

    getAvailableStock(product, warehouseId) {
        if (!product) {
            return 0;
        }
        warehouseId = warehouseId || this.config?.warehouse_id?.id || this.config?.warehouse_id;
        const qtyType = this.config?.ab_stock_qty_type || "free_qty";

        // 1. If product is a variant (has product_tmpl_id)
        if (product.product_tmpl_id) {
            const whData =
                product.ab_stock_warehouses?.[warehouseId] ??
                product.ab_stock_warehouses?.[String(warehouseId)];
            if (whData) {
                return whData[qtyType] || 0;
            }
            const tmpl = product.product_tmpl_id;
            const tmplStock =
                tmpl?.ab_stock_warehouses?.[warehouseId] ??
                tmpl?.ab_stock_warehouses?.[String(warehouseId)];
            return tmplStock ? (tmplStock[qtyType] || 0) : 0;
        }

        // 2. If product is a template with multiple variants: aggregate variant stock
        const variants = this._getProductVariants(product);
        if (variants.length > 1) {
            let total = 0;
            let found = false;
            for (const variant of variants) {
                const whData =
                    variant.ab_stock_warehouses?.[warehouseId] ??
                    variant.ab_stock_warehouses?.[String(warehouseId)];
                if (whData) {
                    found = true;
                    total += (whData[qtyType] || 0);
                }
            }
            if (found) {
                return total;
            }
        }

        // 3. Direct template stock dictionary
        const directStock =
            product.ab_stock_warehouses?.[warehouseId] ??
            product.ab_stock_warehouses?.[String(warehouseId)];
        if (directStock) {
            return directStock[qtyType] || 0;
        }

        // 4. Any warehouse in ab_stock_warehouses if specific warehouse not matched
        if (product.ab_stock_warehouses && typeof product.ab_stock_warehouses === "object") {
            const values = Object.values(product.ab_stock_warehouses);
            if (values.length > 0 && values[0]) {
                return values[0][qtyType] || 0;
            }
        }

        return 0;
    },

    _getProductVariants(productTmpl) {
        if (!productTmpl) {
            return [];
        }
        if (productTmpl.product_variant_ids?.length) {
            return productTmpl.product_variant_ids
                .map((v) => (typeof v === "object" ? v : this.models["product.product"]?.get(v)))
                .filter(Boolean);
        }
        return this.models["product.product"]?.filter((p) => p.product_tmpl_id?.id === productTmpl.id) || [];
    },

    getOrderedQtyInCart(product) {
        const order = this.currentOrder;
        if (!product || !order?.lines) {
            return 0;
        }
        const isVariant = Boolean(product.product_tmpl_id);
        const productId = product.id;
        const tmplId = product.product_tmpl_id?.id || product.id;

        let qty = 0;
        for (const line of order.lines) {
            const lineProd = line.product_id;
            if (!lineProd) {
                continue;
            }
            const matches = isVariant
                ? lineProd.id === productId
                : (lineProd.product_tmpl_id?.id === tmplId || lineProd.id === tmplId);
            if (matches) {
                qty += (line.qty || 0);
            }
        }
        return qty;
    },

    isProductOutOfStock(product, extraQty = 0) {
        if (!product) {
            return false;
        }
        const threshold = this.getDenyThreshold(product);
        if (threshold === null) {
            return false;
        }
        const available = this.getAvailableStock(product);
        const ordered = this.getOrderedQtyInCart(product);
        const reqQty = extraQty > 0 ? extraQty : 1;
        const remaining = available - ordered - reqQty;
        return remaining < threshold;
    },

    isProductSnoozed(product) {
        if (super.isProductSnoozed(product)) {
            return true;
        }
        return this.isProductOutOfStock(product);
    },

    addToCart(productTemplate, qty, customer_note, selectedValues = {}, customValues = {}, comboValues = {}) {
        if (this.isProductSnoozed(productTemplate)) {
            return;
        }
        return super.addToCart(...arguments);
    },
});

patch(ProductCard.prototype, {
    get isProductSnoozed() {
        return this.selfOrder.isProductSnoozed(this.props.product);
    },
    selectProduct() {
        if (this.isProductSnoozed) {
            return;
        }
        return super.selectProduct(...arguments);
    },
});

patch(ProductPage.prototype, {
    get currentVariant() {
        const attributeIds = this.getSelectedAttributesValues();
        return (
            getProductVariantByAttributes(
                this.selfOrder.models,
                this.productTemplate,
                attributeIds
            ) || this.productTemplate
        );
    },
    get isOutOfStock() {
        const product = this.currentVariant || this.productTemplate;
        return Boolean(this.selfOrder.isProductSnoozed(product));
    },
    isAddToCartEnabled() {
        return super.isAddToCartEnabled() && !this.isOutOfStock;
    },
});

patch(CartPage.prototype, {
    changeQuantity(line, increase) {
        if (increase) {
            const product = line.product_id;
            if (product && this.selfOrder.isProductOutOfStock(product, 1)) {
                return;
            }
        }
        return super.changeQuantity(...arguments);
    },
});

