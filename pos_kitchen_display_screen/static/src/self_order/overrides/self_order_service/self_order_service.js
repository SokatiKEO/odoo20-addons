import { SelfOrder } from "@pos_self_order/app/services/self_order_service";
import { patch } from "@web/core/utils/patch";

patch(SelfOrder.prototype, {
    async setup() {
        await super.setup(...arguments);
        this.data.connectWebSocket("POS_PREP_STAGE_UPDATE", (payload) => {
            const updates = payload?.updates || [];
            for (const upd of updates) {
                if (upd.line_uuid) {
                    const line = this.models["pos.order.line"]?.getBy?.("uuid", upd.line_uuid);
                    if (line) {
                        line.prep_status = upd.status;
                        line.prep_stage_name = upd.stage_name;
                        line.prep_stage_color = upd.stage_color;
                        line.prep_stage_change_time = upd.stage_change_time;
                        line.prep_sent_time = upd.sent_time;
                    }
                }
            }
            this.getUserDataFromServer();
        });
    },
});

