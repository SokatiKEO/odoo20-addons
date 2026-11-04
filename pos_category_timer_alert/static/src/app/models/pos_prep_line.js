import { patch } from "@web/core/utils/patch";
import { PosPrepLine } from "@pos_enterprise/app/models/pos_prep_line";
import { safeDurationSince } from "../utils/utils";

patch(PosPrepLine.prototype, {
    /**
     * Resolves the alert timer in minutes for this line based on its product's POS categories.
     * Searches up the category parent hierarchy if the immediate category has no timer set.
     * If a product belongs to multiple categories with timers, takes the maximum preparation limit.
     *
     * @returns {number} Alert timer in minutes (0 if no timer is configured).
     */
    get alertTimer() {
        let maxTimer = 0;
        const categories = this.categories || [];
        for (const categ of categories) {
            let current = categ;
            const visited = new Set();
            while (current && !visited.has(current.id)) {
                visited.add(current.id);
                if (current.alert_timer > 0) {
                    maxTimer = Math.max(maxTimer, current.alert_timer);
                    break;
                }
                const parentId =
                    current.parent_id?.id ||
                    (typeof current.parent_id === "number" ? current.parent_id : null);
                current = parentId && this.models ? this.models["pos.category"]?.get(parentId) : null;
            }
        }
        return maxTimer;
    },

    /**
     * Total elapsed preparation duration of this item in minutes since creation.
     * Must be a method (not a getter) to avoid WithLazyGetterTrap caching via Owl computed().
     *
     * @returns {number} Elapsed duration in minutes.
     */
    computeTotalDuration() {
        const startTime =
            this.create_date ||
            this.prep_order_id?.create_date ||
            this.prep_order_id?.pos_order_id?.date_order ||
            this.last_stage_change;
        return safeDurationSince(startTime);
    },

    /**
     * Determines whether this line is currently in alert status.
     * Completed lines (todo === false) and cancelled lines never alert.
     * Must be a method to ensure real-time re-evaluation.
     *
     * @returns {boolean} True if active and preparation time exceeds category alert timer.
     */
    computeIsAlert() {
        if (!this.todo || this.isCancelled) {
            return false;
        }
        const timer = this.alertTimer;
        if (timer > 0) {
            return this.computeTotalDuration() > timer;
        }
        return false;
    },
});
