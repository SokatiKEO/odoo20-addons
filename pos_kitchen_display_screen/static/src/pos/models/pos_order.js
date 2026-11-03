import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { patch } from "@web/core/utils/patch";

patch(PosOrder.prototype, {
    removeOrderline(line, deep = true) {
        const res = super.removeOrderline(...arguments);
        if (this.table_id && this.isSynced) {
            const pos = this.pos || this.models?.["pos.order"]?.env?.services?.pos;
            if (pos) {
                pos.addPendingOrder([this.id]);
                pos.syncAllOrdersDebounced?.();
            }
        }
        return res;
    },
});
