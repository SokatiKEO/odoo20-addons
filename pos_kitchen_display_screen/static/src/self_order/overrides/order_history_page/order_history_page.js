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
        if (order.prep_status === "ready") {
            return "Ready";
        }
        if (order.prep_status === "served") {
            return "Served";
        }
        return "";
    },

    getOrderStageColor(order) {
        if (order.prep_stage_color) {
            return order.prep_stage_color;
        }
        if (order.prep_status === "ready") {
            return "#008bf5";
        }
        if (order.prep_status === "served") {
            return "#59C629";
        }
        return "#C8C9CB";
    },

    getLineStageName(line) {
        if (!line.prep_stage_name && !line.prep_status && !line.manual_served) {
            return "";
        }
        if (line.prep_status === "ready") {
            return "Ready";
        }
        if (line.prep_status === "served" || line.manual_served) {
            return "Served";
        }
        if (line.prep_stage_name) {
            return line.prep_stage_name;
        }
        return "";
    },

    getLineStageColor(line) {
        if (line.prep_stage_color) {
            return line.prep_stage_color;
        }
        if (line.prep_status === "ready") {
            return "#008bf5";
        }
        if (line.prep_status === "served" || line.manual_served) {
            return "#59C629";
        }
        return "#C8C9CB";
    },
});
