import { patch } from "@web/core/utils/patch";
import { normalize } from "@web/core/l10n/utils";
import { constructAttributeString } from "@point_of_sale/utils";
import { ProductTemplate } from "@point_of_sale/app/models/product_template";
import { ProductProduct } from "@point_of_sale/app/models/product_product";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { ProductCard } from "@point_of_sale/app/components/product_card/product_card";
import { ComboConfiguratorPopup } from "@point_of_sale/app/components/popups/combo_configurator_popup/combo_configurator_popup";
import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { PosOrder } from "@point_of_sale/app/models/pos_order";

function formatPosKhmerName(product, config, fallbackName) {
    const khmerName = product?.khmer_name || product?.product_tmpl_id?.khmer_name;
    const defaultName =
        fallbackName ??
        product?.name ??
        product?.product_tmpl_id?.name ??
        product?.display_name ??
        "";
    if (!config?.khmer_name_apply_pos || !config?.khmer_name_display_mode || !khmerName) {
        return null;
    }
    if (config.khmer_name_display_mode === "both") {
        return defaultName && defaultName !== khmerName
            ? `${khmerName} / ${defaultName}`
            : khmerName;
    }
    return khmerName;
}

patch(ProductTemplate.prototype, {
    get displayKhmerOrName() {
        const config = this.config || this.models?.["pos.config"]?.getFirst();
        return formatPosKhmerName(this, config, this.name) || this.name;
    },

    get displayName() {
        const config = this.config || this.models?.["pos.config"]?.getFirst();
        const formatted = formatPosKhmerName(this, config, this.display_name);
        if (formatted) {
            return this.default_code ? `[${this.default_code}] ${formatted}` : formatted;
        }
        return super.displayName;
    },

    get searchString() {
        const base = super.searchString;
        if (this.khmer_name) {
            const khmerNorm = normalize(this.khmer_name);
            if (!base.includes(khmerNorm)) {
                return `${base} ${khmerNorm}`;
            }
        }
        return base;
    },
});

patch(ProductProduct.prototype, {
    get displayKhmerOrName() {
        const config = this.config || this.models?.["pos.config"]?.getFirst();
        const defaultName = this.name || this.product_tmpl_id?.name || this.display_name;
        return formatPosKhmerName(this, config, defaultName) || defaultName;
    },

    get searchString() {
        const base = super.searchString;
        const khmerName = this.khmer_name || this.product_tmpl_id?.khmer_name;
        if (khmerName) {
            const khmerNorm = normalize(khmerName);
            if (!base.includes(khmerNorm)) {
                return `${base} ${khmerNorm}`;
            }
        }
        return base;
    },
});

patch(ProductScreen.prototype, {
    getProductName(product) {
        const defaultName = super.getProductName(product);
        return formatPosKhmerName(product, this.pos?.config, defaultName) || defaultName;
    },
});

patch(ProductCard.prototype, {
    get displayProductName() {
        const product = this.props.product;
        const config = product?.config || product?.models?.["pos.config"]?.getFirst();
        const baseDefaultName =
            product?.name || product?.product_tmpl_id?.name || this.props.name;
        const formatted = formatPosKhmerName(product, config, baseDefaultName);
        if (formatted) {
            const attributes = product?.product_template_variant_value_ids
                ?.map((attr) => attr.name)
                .join(", ");
            return attributes && this.props.isComboPopup
                ? `${formatted} (${attributes})`
                : formatted;
        }
        return this.props.name;
    },
});

patch(ComboConfiguratorPopup.prototype, {
    get title() {
        if (!this.props.title) {
            const formatted = formatPosKhmerName(
                this.props.productTemplate,
                this.pos?.config,
                this.props.productTemplate?.display_name
            );
            if (formatted) {
                return formatted;
            }
        }
        return super.title;
    },
});

patch(PosOrderline.prototype, {
    setFullProductName() {
        super.setFullProductName();
        const formatted = formatPosKhmerName(
            this.product_id,
            this.config,
            this.product_id?.name
        );
        if (formatted) {
            const attributeString = constructAttributeString(this);
            this.full_product_name = attributeString
                ? `${formatted} (${attributeString})`
                : formatted;
        }
    },

    getFullProductName() {
        const formatted = formatPosKhmerName(
            this.product_id,
            this.config,
            this.product_id?.name
        );
        if (formatted) {
            const attributeString = constructAttributeString(this);
            return attributeString ? `${formatted} (${attributeString})` : formatted;
        }
        return super.getFullProductName();
    },

    get orderDisplayProductName() {
        const res = super.orderDisplayProductName;
        const formatted = formatPosKhmerName(
            this.product_id,
            this.config,
            this.product_id?.name
        );
        if (formatted) {
            return {
                ...res,
                name: formatted,
            };
        }
        return res;
    },
});

patch(PosOrder.prototype, {
    dataMaker(line, curr = {}) {
        const res = super.dataMaker(line, curr);
        const formatted = formatPosKhmerName(
            line?.product_id,
            this.config,
            line?.product_id?.name
        );
        if (formatted && res?.data) {
            res.data.basic_name = formatted;
        }
        return res;
    },
});
