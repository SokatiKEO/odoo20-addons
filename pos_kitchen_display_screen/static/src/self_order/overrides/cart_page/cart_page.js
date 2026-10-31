import { CartPage } from "@pos_self_order/app/pages/cart_page/cart_page";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

const { DateTime } = luxon;

patch(CartPage.prototype, {
    get orderTitle() {
        const table =
            this.selfOrder.currentTable ||
            this.selfOrder.currentOrder?.table_id ||
            this.selfOrder.currentOrder?.self_ordering_table_id;
        const tableName =
            table?.table_name ||
            (table?.table_number ? _t("Table %s", table.table_number) : "") ||
            this.selfOrder.currentOrder?.table_name;
        if (tableName) {
            return `${tableName} - ${_t("Your Order")}`;
        }
        return _t("Your Order");
    },

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

    getLineStageName(line) {
        const isSent = line.id || !this.selfOrder.currentOrder?.unsentLines?.includes(line);
        if (!isSent) {
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
        if (isSent && (this.selfOrder.currentOrder?.isSynced || line.id)) {
            return "To cook";
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
