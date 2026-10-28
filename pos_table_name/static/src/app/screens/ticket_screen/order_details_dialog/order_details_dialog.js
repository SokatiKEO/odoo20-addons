import { OrderDetailsDialog } from "@point_of_sale/app/screens/ticket_screen/order_details_dialog/order_details_dialog";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

patch(OrderDetailsDialog.prototype, {
    getOrderFields() {
        const fields = super.getOrderFields(...arguments);
        const table = this.getTableInfo?.();
        if (table) {
            const tableField = fields.find((f) => f.id === "table");
            if (tableField) {
                tableField.value = `${table.floor_id.name}, ${_t("Table")} ${table.getName()}`;
            }
        }
        return fields;
    },
});
