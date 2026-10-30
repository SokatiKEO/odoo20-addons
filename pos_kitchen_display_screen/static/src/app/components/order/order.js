import { patch } from "@web/core/utils/patch";
import { Order } from "@pos_enterprise/app/components/order/order";

patch(Order.prototype, {
    get tableName() {
        return this.order?.pos_order_id?.table_name || "";
    },

    get order_name() {
        const origName = super.order_name;
        if (this.tableName && this.tableName !== origName) {
            return `${this.tableName} - ${origName}`;
        }
        return origName;
    },
});
