import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { patch } from "@web/core/utils/patch";

patch(PosOrderline.prototype, {
    canBeMergedWith(orderline) {
        const thisSent = Boolean(
            this.prep_status ||
            this.prep_stage_name ||
            this.prep_sent_time ||
            this.manual_served
        );
        const otherSent = Boolean(
            orderline.prep_status ||
            orderline.prep_stage_name ||
            orderline.prep_sent_time ||
            orderline.manual_served
        );
        // Do not merge if either line is already in preparation / has a stage
        if (thisSent || otherSent) {
            return false;
        }
        return super.canBeMergedWith(...arguments);
    },
});

