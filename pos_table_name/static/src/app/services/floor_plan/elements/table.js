import { FloorTable } from "@pos_restaurant/app/services/floor_plan/elements/table";
import { patch } from "@web/core/utils/patch";

patch(FloorTable.prototype, {
    get table_name() {
        return this.tableName || "";
    },
    set table_name(name) {
        this.tableName = name || "";
    },
    get displayName() {
        return this.tableName || String(this.tableNumber ?? "");
    },
    get raw() {
        return {
            ...super.raw,
            table_name: this.table_name,
        };
    },
});
