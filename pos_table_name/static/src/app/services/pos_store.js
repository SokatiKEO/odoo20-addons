import { PosStore } from "@point_of_sale/app/services/pos_store";
import { patch } from "@web/core/utils/patch";

patch(PosStore.prototype, {
    findTable(tableQuery) {
        if (tableQuery != null) {
            const normalized = String(tableQuery).trim().toLowerCase();
            if (normalized) {
                const matchByName = (t) =>
                    Boolean(t.table_name) && t.table_name.trim().toLowerCase() === normalized;
                const namedTable =
                    this.currentFloor?.table_ids.find(matchByName) ||
                    this.models["restaurant.table"].find(matchByName);
                if (namedTable) {
                    return namedTable;
                }
            }
        }
        return super.findTable(...arguments);
    },
});
