import { OrdersHistoryPage } from "@pos_self_order/app/pages/order_history_page/order_history_page";
import { patch } from "@web/core/utils/patch";

const { DateTime } = luxon;

patch(OrdersHistoryPage.prototype, {
    formatTime(val) {
        if (!val) {
            return "";
        }
        if (typeof val === "string") {
            let dt = DateTime.fromSQL(val, { zone: "utc" });
            if (!dt.isValid) {
                dt = DateTime.fromISO(val, { zone: "utc" });
            }
            if (dt.isValid) {
                return dt.toLocal().toLocaleString(DateTime.TIME_WITH_SECONDS);
            }
            return val;
        }
        if (val && typeof val.toLocaleString === "function") {
            return val.toLocaleString(DateTime.TIME_WITH_SECONDS);
        }
        return String(val);
    },

    getOrderStageName(order) {
        if (order.prep_stage_name) {
            return order.prep_stage_name;
        }
        return "";
    },

    getOrderStageColor(order) {
        if (order.prep_stage_color) {
            return order.prep_stage_color;
        }
        return "#C8C9CB";
    },

    getLineStageName(line) {
        if (line.prep_stage_name) {
            return line.prep_stage_name;
        }
        return "";
    },

    getLineStageColor(line) {
        if (line.prep_stage_color) {
            return line.prep_stage_color;
        }
        return "#C8C9CB";
    },
});
