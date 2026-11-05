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

patch(ProductTemplate.prototype, {
    get displayKhmerOrName() {
        const config = this.config || this.models?.["pos.config"]?.getFirst();
        if (config?.show_khmer_name && this.khmer_name) {
            return this.khmer_name;
        }
        return this.name;
    },

    get displayName() {
        const config = this.config || this.models?.["pos.config"]?.getFirst();
        if (config?.show_khmer_name && this.khmer_name) {
            return this.default_code
                ? `[${this.default_code}] ${this.khmer_name}`
                : this.khmer_name;
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
        const khmerName = this.khmer_name || this.product_tmpl_id?.khmer_name;
        if (config?.show_khmer_name && khmerName) {
            return khmerName;
        }
        return this.name || this.product_tmpl_id?.name || this.display_name;
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
        const khmerName = product?.khmer_name || product?.product_tmpl_id?.khmer_name;
        if (this.pos?.config?.show_khmer_name && khmerName) {
            return khmerName;
        }
        return super.getProductName(product);
    },
});

patch(ProductCard.prototype, {
    get displayProductName() {
        const product = this.props.product;
        const config = product?.config || product?.models?.["pos.config"]?.getFirst();
        const khmerName = product?.khmer_name || product?.product_tmpl_id?.khmer_name;
        if (config?.show_khmer_name && khmerName) {
            const attributes = product?.product_template_variant_value_ids
                ?.map((attr) => attr.name)
                .join(", ");
            return attributes && this.props.isComboPopup
                ? `${khmerName} (${attributes})`
                : khmerName;
        }
        return this.props.name;
    },
});

patch(ComboConfiguratorPopup.prototype, {
    get title() {
        if (!this.props.title && this.pos?.config?.show_khmer_name) {
            const khmerName =
                this.props.productTemplate?.khmer_name ||
                this.props.productTemplate?.product_tmpl_id?.khmer_name;
            if (khmerName) {
                return khmerName;
            }
        }
        return super.title;
    },
});

patch(PosOrderline.prototype, {
    setFullProductName() {
        super.setFullProductName();
        const khmerName =
            this.product_id?.khmer_name || this.product_id?.product_tmpl_id?.khmer_name;
        if (this.config?.show_khmer_name && khmerName) {
            const attributeString = constructAttributeString(this);
            this.full_product_name = attributeString
                ? `${khmerName} (${attributeString})`
                : khmerName;
        }
    },

    getFullProductName() {
        const khmerName =
            this.product_id?.khmer_name || this.product_id?.product_tmpl_id?.khmer_name;
        if (this.config?.show_khmer_name && khmerName) {
            const attributeString = constructAttributeString(this);
            return attributeString ? `${khmerName} (${attributeString})` : khmerName;
        }
        return super.getFullProductName();
    },

    get orderDisplayProductName() {
        const res = super.orderDisplayProductName;
        const khmerName =
            this.product_id?.khmer_name || this.product_id?.product_tmpl_id?.khmer_name;
        if (this.config?.show_khmer_name && khmerName) {
            return {
                ...res,
                name: khmerName,
            };
        }
        return res;
    },
});

patch(PosOrder.prototype, {
    dataMaker(line, curr = {}) {
        const res = super.dataMaker(line, curr);
        const khmerName =
            line?.product_id?.khmer_name || line?.product_id?.product_tmpl_id?.khmer_name;
        if (this.config?.show_khmer_name && khmerName && res?.data) {
            res.data.basic_name = khmerName;
        }
        return res;
    },
});

