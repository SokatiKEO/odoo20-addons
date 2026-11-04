import { patch } from "@web/core/utils/patch";
import { Order } from "@pos_enterprise/app/components/order/order";

patch(Order.prototype, {
    get tableName() {
        return this.order?.pos_order_id?.table_name || "";
    },

    get order_name() {
        if (this.tableName) {
            return this.tableName;
        }
        const posOrder = this.order?.pos_order_id;
        const table = posOrder?.table_id;
        if (table) {
            const tName = table.table_name || "";
            const tNumber = table.table_number != null ? String(table.table_number) : "";
            const floorName = table.floor_id?.name || "";
            const label = tName.trim() || tNumber.trim();
            if (label) {
                return floorName ? `${label} (${floorName})` : label;
            }
        }
        return super.order_name;
    },
});
