import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { patch } from "@web/core/utils/patch";

patch(TicketScreen.prototype, {
    getTableTag(order) {
        return order.table_id?.getName();
    },
    _getSearchFields() {
        const res = super._getSearchFields(...arguments);
        if (this.pos.config.module_pos_restaurant && res.REFERENCE?.modelFields) {
            if (!res.REFERENCE.modelFields.includes("table_id.table_name")) {
                res.REFERENCE.modelFields.push("table_id.table_name");
            }
        }
        return res;
    },
});
