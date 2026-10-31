import { patch } from "@web/core/utils/patch";
import { Orderline } from "@pos_enterprise/app/components/orderline/orderline";
import { ProductImageDialog } from "../product_image_dialog/product_image_dialog";

const { DateTime } = luxon;

patch(Orderline.prototype, {
    get stageName() {
        return (
            this.preparation_line?.stage_id?.name ||
            this.preparation_line?.prep_display_ids?.[0]?.stage_ids?.[0]?.name ||
            ""
        );
    },
    get cashierName() {
        const order = this.preparation_line?.prep_order_id?.pos_order_id;
        return (
            order?.cashier_name ||
            order?.employee_id?.name ||
            order?.user_id?.name ||
            ""
        );
    },
    get stageTimeDisplay() {
        const line = this.preparation_line;
        const dt = line?.last_stage_change || line?.prep_order_id?.pos_order_id?.create_date || line?.create_date;
        return this._formatKdsTime(dt);
    },
    get sentTimeDisplay() {
        const line = this.preparation_line;
        const dt = line?.prep_order_id?.pos_order_id?.create_date || line?.create_date;
        return this._formatKdsTime(dt);
    },
    get stageChangeTimeDisplay() {
        const line = this.preparation_line;
        return this._formatKdsTime(line?.last_stage_change);
    },
    _formatKdsTime(val) {
        if (!val) {
            return "";
        }
        let dt;
        if (typeof val === "string") {
            dt = DateTime.fromISO(val.includes("T") ? val : val.replace(" ", "T") + "Z");
        } else if (val && typeof val === "object" && val.isLuxonDateTime) {
            dt = val;
        } else if (val instanceof Date) {
            dt = DateTime.fromJSDate(val);
        }
        if (dt && dt.isValid) {
            return dt.toLocaleString(DateTime.TIME_WITH_SECONDS);
        }
        return "";
    },
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

