import { Component, proxy, t, useProps } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";

export const productImageDialogProps = {
    close: t.function(),
    title: t.string().optional(_t("Product Image")),
    size: t.string().optional("md"),
    imageUrl: t.string(),
    productName: t.string().optional(),
};

export class ProductImageDialog extends Component {
    static template = "pos_kitchen_display_screen.ProductImageDialog";
    static components = { Dialog };
    props = useProps(productImageDialogProps);

    setup() {
        this.state = proxy({
            imageError: false,
        });
    }

    onImageError() {
        this.state.imageError = true;
    }
}

