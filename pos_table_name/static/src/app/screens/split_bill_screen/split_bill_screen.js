import { SplitBillScreen } from "@pos_restaurant/app/screens/split_bill_screen/split_bill_screen";
import { patch } from "@web/core/utils/patch";

patch(SplitBillScreen.prototype, {
    _getOrderName(order) {
        return order.table_id?.getName() || super._getOrderName(...arguments);
    },
});
