import { patch } from "@web/core/utils/patch";
import { Orderline } from "@pos_enterprise/app/components/orderline/orderline";
import { Category } from "@pos_enterprise/app/components/category/category";
import { ProductImageDialog } from "@pos_kitchen_display_screen/app/components/product_image_dialog/product_image_dialog";

function formatKdsKhmerName(khmerName, defaultName, config) {
    if (!config?.khmer_name_apply_kitchen || !config?.khmer_name_display_mode || !khmerName) {
        return defaultName;
    }
    if (config.khmer_name_display_mode === "both") {
        return defaultName && defaultName !== khmerName
            ? `${khmerName} / ${defaultName}`
            : khmerName;
    }
    return khmerName;
}

patch(Orderline.prototype, {
    get displayProductName() {
        const product = this.preparation_line?.product_id;
        if (!product) {
            return "";
        }
        const config =
            this.preparation_line?.prep_order_id?.pos_order_id?.config_id ||
            this.prepDisplay?.data?.models?.["pos.config"]?.find(
                (c) => c.khmer_name_apply_kitchen && c.khmer_name_display_mode
            );
        const defaultName =
            (config?.module_pos_restaurant ? product.name : product.display_name) ||
            product.name ||
            product.display_name ||
            "";
        return formatKdsKhmerName(product.khmer_name, defaultName, config);
    },

    previewImage() {
        const product = this.preparation_line?.product_id;
        if (!product) {
            return;
        }
        const productName = this.displayProductName;
        const writeDate = product.write_date ? `&unique=${encodeURIComponent(product.write_date)}` : "";
        const imageUrl = `/web/image?model=product.product&id=${product.id}&field=image_512${writeDate}`;

        this.prepDisplay.dialog.add(ProductImageDialog, {
            title: productName,
            imageUrl: imageUrl,
            productName: productName,
        });
    },
});

patch(Category.prototype, {
    get shouldShowCategory() {
        const length = super.shouldShowCategory;
        const activeConfig = this.prepDisplay?.data?.models?.["pos.config"]?.find(
            (c) => c.khmer_name_apply_kitchen && c.khmer_name_display_mode
        );
        if (activeConfig && this.products?.length) {
            const productModel = this.prepDisplay?.data?.models?.["product.product"];
            for (const item of this.products) {
                const prodRecord = productModel?.get(item.id);
                if (prodRecord?.khmer_name) {
                    item.name = formatKdsKhmerName(
                        prodRecord.khmer_name,
                        item.name,
                        activeConfig
                    );
                }
            }
        }
        return length;
    },
});
