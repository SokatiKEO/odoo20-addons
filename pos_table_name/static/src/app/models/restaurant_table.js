import { RestaurantTable } from "@pos_restaurant/app/models/restaurant_table";
import { patch } from "@web/core/utils/patch";

patch(RestaurantTable.prototype, {
    setup(vals) {
        super.setup(vals);
        this.table_name = vals.table_name || "";
    },
    getName() {
        return this.table_name || super.getName(...arguments);
    },
});
