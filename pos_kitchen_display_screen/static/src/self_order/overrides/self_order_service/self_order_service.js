import { SelfOrder } from "@pos_self_order/app/services/self_order_service";
import { patch } from "@web/core/utils/patch";

patch(SelfOrder.prototype, {
    async setup() {
        await super.setup(...arguments);
        if (this.data) {
            this.data.connectWebSocket("POS_PREP_STAGE_UPDATE", (payload) => {
                const updates = payload?.updates || (Array.isArray(payload) ? payload : [payload]);
                for (const upd of updates) {
                    let line = null;
                    if (upd.line_uuid) {
                        line =
                            this.models["pos.order.line"]?.getBy?.("uuid", upd.line_uuid) ||
                            this.models["pos.order.line"]?.getAll?.()?.find?.((l) => l.uuid === upd.line_uuid);
                    }
                    if (!line && upd.line_id) {
                        line =
                            this.models["pos.order.line"]?.get?.(upd.line_id) ||
                            this.models["pos.order.line"]?.getAll?.()?.find?.((l) => l.id === upd.line_id);
                    }
                    if (line) {
                        line.prep_status = upd.status;
                        if (upd.manual_served !== undefined) {
                            line.manual_served = upd.manual_served;
                        } else if (upd.status === "served") {
                            line.manual_served = true;
                        } else if (upd.status === false) {
                            line.manual_served = false;
                        }
                        if (upd.stage_id) {
                            line.prep_stage_id = upd.stage_id;
                        }
                        if (upd.stage_name) {
                            line.prep_stage_name = upd.stage_name;
                        }
                        if (upd.stage_color) {
                            line.prep_stage_color = upd.stage_color;
                        }
                        if (upd.stage_change_time) {
                            line.prep_stage_change_time = upd.stage_change_time;
                        }
                        if (upd.sent_time && !line.prep_sent_time) {
                            line.prep_sent_time = upd.sent_time;
                        }
                    }
                }
                this.getUserDataFromServer();
            });
        }
    },
});
