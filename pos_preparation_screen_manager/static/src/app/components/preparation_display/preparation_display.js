import { patch } from "@web/core/utils/patch";
import { PrepDisplay } from "@pos_enterprise/app/components/preparation_display/preparation_display";

patch(PrepDisplay.prototype, {
    get isReadOnly() {
        return Boolean(this.prepDisplay?.isReadOnly);
    },

    get isEmbed() {
        return Boolean(this.prepDisplay?.isEmbed);
    },

    archiveAllVisibleOrders() {
        if (this.isReadOnly) {
            return;
        }
        return super.archiveAllVisibleOrders(...arguments);
    },

    recallLastChange() {
        if (this.isReadOnly) {
            return;
        }
        return super.recallLastChange(...arguments);
    },

    async _barcodeProductAction() {
        if (this.isReadOnly) {
            return;
        }
        return super._barcodeProductAction(...arguments);
    },
});

