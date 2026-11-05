import { patch } from "@web/core/utils/patch";
import { Orderline } from "@pos_enterprise/app/components/orderline/orderline";
import { Category } from "@pos_enterprise/app/components/category/category";
import { ProductImageDialog } from "@pos_kitchen_display_screen/app/components/product_image_dialog/product_image_dialog";

patch(Orderline.prototype, {
    get displayProductName() {
        const product = this.preparation_line?.product_id;
        if (!product) {
            return "";
        }
        const config = this.preparation_line?.prep_order_id?.pos_order_id?.config_id;
        const useKhmer = config
            ? Boolean(config.show_khmer_name)
            : Boolean(this.prepDisplay?.data?.models?.["pos.config"]?.some((c) => c.show_khmer_name));
        if (useKhmer && product.khmer_name) {
            return product.khmer_name;
        }
        return (
            (config?.module_pos_restaurant ? product.name : product.display_name) ||
            product.name ||
            product.display_name ||
            ""
        );
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
        const useKhmer = Boolean(
            this.prepDisplay?.data?.models?.["pos.config"]?.some((c) => c.show_khmer_name)
        );
        if (useKhmer && this.products?.length) {
            const productModel = this.prepDisplay?.data?.models?.["product.product"];
            for (const item of this.products) {
                const prodRecord = productModel?.get(item.id);
                if (prodRecord?.khmer_name) {
                    item.name = prodRecord.khmer_name;
                }
            }
        }
        return length;
    },
});

