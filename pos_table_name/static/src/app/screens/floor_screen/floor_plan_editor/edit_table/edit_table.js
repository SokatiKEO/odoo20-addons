import { EditTableProperties } from "@pos_restaurant/app/screens/floor_screen/floor_plan_editor/edit_table/edit_table";
import { patch } from "@web/core/utils/patch";

patch(EditTableProperties.prototype, {
    updateTableName(event) {
        this.updateTable({ table_name: event.target.value });
    },
});
