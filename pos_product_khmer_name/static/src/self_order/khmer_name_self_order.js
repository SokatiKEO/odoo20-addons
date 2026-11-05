import { patch } from "@web/core/utils/patch";
import { constructAttributeString } from "@point_of_sale/utils";
import { ProductTemplate } from "@point_of_sale/app/models/product_template";
import { ProductProduct } from "@point_of_sale/app/models/product_product";
import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { ProductCard } from "@pos_self_order/app/components/product_card/product_card";
import { CartPage } from "@pos_self_order/app/pages/cart_page/cart_page";
import { ComboPage } from "@pos_self_order/app/pages/combo_page/combo_page";
import { SelfOrder } from "@pos_self_order/app/services/self_order_service";

function formatKhmerOrDefaultProductName(product, showKhmer) {
    const khmerName = product?.khmer_name || product?.product_tmpl_id?.khmer_name;
    const baseName = showKhmer && khmerName ? khmerName : product?.name;
    const attributes = product?.product_template_attribute_value_ids
        ?.map((v) => v.name)
        .join(",");
    return attributes ? `${baseName} (${attributes})` : baseName;
}

patch(ProductTemplate.prototype, {
    get displayKhmerOrName() {
        const config = this.models?.["pos.config"]?.getFirst();
        if (config?.show_khmer_name && this.khmer_name) {
            return this.khmer_name;
        }
        return this.name;
    },
});

patch(ProductProduct.prototype, {
    get displayKhmerOrName() {
        const config = this.models?.["pos.config"]?.getFirst();
        const khmerName = this.khmer_name || this.product_tmpl_id?.khmer_name;
        if (config?.show_khmer_name && khmerName) {
            return khmerName;
        }
        return this.name || this.product_tmpl_id?.name || this.display_name;
    },
});

patch(PosOrderline.prototype, {
    setFullProductName() {
        super.setFullProductName();
        const config = this.config || this.models?.["pos.config"]?.getFirst();
        const khmerName =
            this.product_id?.khmer_name || this.product_id?.product_tmpl_id?.khmer_name;
        if (config?.show_khmer_name && khmerName) {
            const attributeString = constructAttributeString(this);
            this.full_product_name = attributeString
                ? `${khmerName} (${attributeString})`
                : khmerName;
        }
    },

    getFullProductName() {
        const config = this.config || this.models?.["pos.config"]?.getFirst();
        const khmerName =
            this.product_id?.khmer_name || this.product_id?.product_tmpl_id?.khmer_name;
        if (config?.show_khmer_name && khmerName) {
            const attributeString = constructAttributeString(this);
            return attributeString ? `${khmerName} (${attributeString})` : khmerName;
        }
        return super.getFullProductName();
    },
});

patch(ProductCard.prototype, {
    formatProductName(product) {
        if (this.selfOrder?.config?.show_khmer_name) {
            return formatKhmerOrDefaultProductName(product, true);
        }
        return super.formatProductName(product);
    },
});

patch(CartPage.prototype, {
    formatProductName(product) {
        if (this.selfOrder?.config?.show_khmer_name) {
            return formatKhmerOrDefaultProductName(product, true);
        }
        return super.formatProductName(product);
    },
});

patch(ComboPage.prototype, {
    formatProductName(product) {
        if (this.selfOrder?.config?.show_khmer_name) {
            return formatKhmerOrDefaultProductName(product, true);
        }
        return super.formatProductName(product);
    },
});

patch(SelfOrder.prototype, {
    async addToCart(
        productTemplate,
        qty,
        customer_note,
        selectedValues = {},
        customValues = {},
        comboValues = {}
    ) {
        await super.addToCart(
            productTemplate,
            qty,
            customer_note,
            selectedValues,
            customValues,
            comboValues
        );
        if (this.config?.show_khmer_name && this.currentOrder?.lines) {
            for (const line of this.currentOrder.lines) {
                const khmerName =
                    line.product_id?.khmer_name ||
                    line.product_id?.product_tmpl_id?.khmer_name;
                if (khmerName) {
                    const attributeString = constructAttributeString(line);
                    line.full_product_name = attributeString
                        ? `${khmerName} (${attributeString})`
                        : khmerName;
                }
            }
        }
    },
});

