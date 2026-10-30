import { patch } from "@web/core/utils/patch";
import { Orderline } from "@pos_enterprise/app/components/orderline/orderline";
import { ProductImageDialog } from "../product_image_dialog/product_image_dialog";

patch(Orderline.prototype, {
    previewImage() {
        const product = this.preparation_line?.product_id;
        if (!product) {
            return;
        }
        const productName =
            (this.preparation_line.prep_order_id?.pos_order_id?.config_id?.module_pos_restaurant
                ? product.name
                : product.display_name) ||
            product.name ||
            product.display_name ||
            "";

        const writeDate = product.write_date ? `&unique=${encodeURIComponent(product.write_date)}` : "";
        const imageUrl = `/web/image?model=product.product&id=${product.id}&field=image_512${writeDate}`;

        this.prepDisplay.dialog.add(ProductImageDialog, {
            title: productName,
            imageUrl: imageUrl,
            productName: productName,
        });
    },
});

