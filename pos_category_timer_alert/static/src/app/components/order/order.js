import { patch } from "@web/core/utils/patch";
import { Order } from "@pos_enterprise/app/components/order/order";
import { safeDurationSince } from "../../utils/utils";

patch(Order.prototype, {
    /**
     * Computes the total elapsed duration of the order card in minutes.
     * Uses order/ticket creation time so that duration persists across stage transitions.
     *
     * @returns {number} Order ticket duration in minutes.
     */
    _getOrderDuration() {
        const startTime =
            this.order?.create_date ||
            this.order?.pos_order_id?.date_order;

        if (startTime) {
            return safeDurationSince(startTime);
        }

        const lineStartTimes = (this.props.order?.prepLines || [])
            .map((pl) => pl.create_date || pl.last_stage_change)
            .filter(Boolean);

        if (lineStartTimes.length) {
            const durations = lineStartTimes.map((t) => safeDurationSince(t));
            return Math.max(...durations);
        }

        return super._getOrderDuration();
    },

    /**
     * Evaluates order duration and alert state.
     * The order card enters alert status if ANY active uncompleted line has exceeded
     * its product category alert timer.
     * Falls back to stage.alert_timer only if no category timers are configured on active items.
     *
     * @returns {number} Current order duration in minutes.
     */
    _computeDuration() {
        const timeDiff = this._getOrderDuration();
        const activeLines = (this.props.order?.prepLines || []).filter(
            (pl) => pl.todo && !pl.isCancelled
        );

        const hasLineAlert = activeLines.some((pl) => pl.computeIsAlert());

        if (hasLineAlert) {
            this.isAlert = true;
        } else {
            const hasCategoryTimers = activeLines.some((pl) => pl.alertTimer > 0);
            if (!hasCategoryTimers && this.props.order?.stage?.alert_timer > 0) {
                this.isAlert = timeDiff > this.props.order.stage.alert_timer;
            } else {
                this.isAlert = false;
            }
        }

        return timeDiff;
    },
});
