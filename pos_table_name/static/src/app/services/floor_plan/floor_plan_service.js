import { FloorPlanStore } from "@pos_restaurant/app/services/floor_plan/floor_plan_service";
import { patch } from "@web/core/utils/patch";

patch(FloorPlanStore.prototype, {
    createTable(data) {
        if (data?.id) {
            const tableRecord = this.pos.models["restaurant.table"].get(data.id);
            if (tableRecord && data.table_name == null) {
                data = {
                    ...data,
                    table_name: tableRecord.table_name || "",
                };
            }
        }
        return super.createTable(data);
    },
});
