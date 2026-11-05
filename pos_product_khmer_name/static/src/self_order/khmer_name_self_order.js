import { patch } from "@web/core/utils/patch";
import { constructAttributeString } from "@point_of_sale/utils";
import { ProductTemplate } from "@point_of_sale/app/models/product_template";
import { ProductProduct } from "@point_of_sale/app/models/product_product";
import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { ProductCard } from "@pos_self_order/app/components/product_card/product_card";
import { CartPage } from "@pos_self_order/app/pages/cart_page/cart_page";
import { ComboPage } from "@pos_self_order/app/pages/combo_page/combo_page";
import { SelfOrder } from "@pos_self_order/app/services/self_order_service";

function getSelfFormattedBaseName(product, config, fallbackName) {
    const khmerName = product?.khmer_name || product?.product_tmpl_id?.khmer_name;
    const defaultName =
        fallbackName ??
        product?.name ??
        product?.product_tmpl_id?.name ??
        product?.display_name ??
        "";
    if (
        !config?.khmer_name_apply_self_order ||
        !config?.khmer_name_display_mode ||
        !khmerName
    ) {
        return defaultName;
    }
    if (config.khmer_name_display_mode === "both") {
        return defaultName && defaultName !== khmerName
            ? `${khmerName} / ${defaultName}`
            : khmerName;
    }
    return khmerName;
}

function formatSelfProductNameWithAttributes(product, config) {
    const baseName = getSelfFormattedBaseName(product, config, product?.name);
    const attributes = product?.product_template_attribute_value_ids
        ?.map((v) => v.name)
        .join(",");
    return attributes ? `${baseName} (${attributes})` : baseName;
}

patch(ProductTemplate.prototype, {
    get displayKhmerOrName() {
        const config = this.models?.["pos.config"]?.getFirst();
        return getSelfFormattedBaseName(this, config, this.name);
    },
});

patch(ProductProduct.prototype, {
    get displayKhmerOrName() {
        const config = this.models?.["pos.config"]?.getFirst();
        const defaultName = this.name || this.product_tmpl_id?.name || this.display_name;
        return getSelfFormattedBaseName(this, config, defaultName);
    },
});

patch(PosOrderline.prototype, {
    setFullProductName() {
        super.setFullProductName();
        const config = this.config || this.models?.["pos.config"]?.getFirst();
        const khmerName =
            this.product_id?.khmer_name || this.product_id?.product_tmpl_id?.khmer_name;
        if (
            config?.khmer_name_apply_self_order &&
            config?.khmer_name_display_mode &&
            khmerName
        ) {
            const baseName = getSelfFormattedBaseName(
                this.product_id,
                config,
                this.product_id?.name
            );
            const attributeString = constructAttributeString(this);
            this.full_product_name = attributeString
                ? `${baseName} (${attributeString})`
                : baseName;
        }
    },

    getFullProductName() {
        const config = this.config || this.models?.["pos.config"]?.getFirst();
        const khmerName =
            this.product_id?.khmer_name || this.product_id?.product_tmpl_id?.khmer_name;
        if (
            config?.khmer_name_apply_self_order &&
            config?.khmer_name_display_mode &&
            khmerName
        ) {
            const baseName = getSelfFormattedBaseName(
                this.product_id,
                config,
                this.product_id?.name
            );
            const attributeString = constructAttributeString(this);
            return attributeString ? `${baseName} (${attributeString})` : baseName;
        }
        return super.getFullProductName();
    },
});

patch(ProductCard.prototype, {
    formatProductName(product) {
        if (
            this.selfOrder?.config?.khmer_name_apply_self_order &&
            this.selfOrder?.config?.khmer_name_display_mode
        ) {
            return formatSelfProductNameWithAttributes(product, this.selfOrder.config);
        }
        return super.formatProductName(product);
    },
});

patch(CartPage.prototype, {
    formatProductName(product) {
        if (
            this.selfOrder?.config?.khmer_name_apply_self_order &&
            this.selfOrder?.config?.khmer_name_display_mode
        ) {
            return formatSelfProductNameWithAttributes(product, this.selfOrder.config);
        }
        return super.formatProductName(product);
    },
});

patch(ComboPage.prototype, {
    formatProductName(product) {
        if (
            this.selfOrder?.config?.khmer_name_apply_self_order &&
            this.selfOrder?.config?.khmer_name_display_mode
        ) {
            return formatSelfProductNameWithAttributes(product, this.selfOrder.config);
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
        if (
            this.config?.khmer_name_apply_self_order &&
            this.config?.khmer_name_display_mode &&
            this.currentOrder?.lines
        ) {
            for (const line of this.currentOrder.lines) {
                const khmerName =
                    line.product_id?.khmer_name ||
                    line.product_id?.product_tmpl_id?.khmer_name;
                if (khmerName) {
                    const baseName = getSelfFormattedBaseName(
                        line.product_id,
                        this.config,
                        line.product_id?.name
                    );
                    const attributeString = constructAttributeString(line);
                    line.full_product_name = attributeString
                        ? `${baseName} (${attributeString})`
                        : baseName;
                }
            }
        }
    },
});
