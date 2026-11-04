import { patch } from "@web/core/utils/patch";
import { Order } from "@pos_enterprise/app/components/order/order";

patch(Order.prototype, {
    changeOrderlineStatus(prepLine) {
        if (this.prepDisplay?.isReadOnly) {
            return;
        }
        return super.changeOrderlineStatus(prepLine);
    },

    async doneOrder() {
        if (this.prepDisplay?.isReadOnly) {
            return;
        }
        return super.doneOrder(...arguments);
    },

    async clickOrder() {
        if (this.prepDisplay?.isReadOnly) {
            return;
        }
        return super.clickOrder(...arguments);
    },
});

