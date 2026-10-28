import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { patch } from "@web/core/utils/patch";

patch(PosOrder.prototype, {
    getName() {
        if (this.config.module_pos_restaurant && !this.isDirectSale && this.getTable()) {
            const table = this.getTable();
            const childTables = this.models["restaurant.table"].filter(
                (t) => t.floor_id && t.floor_id.id === table.floor_id?.id && table.isParent(t)
            );
            let name = "T " + table.getName();
            for (const childTable of childTables) {
                name += ` & ${childTable.getName()}`;
            }
            name += ` - ${this.tracking_number}`;
            return name;
        }
        return super.getName(...arguments);
    },
});
