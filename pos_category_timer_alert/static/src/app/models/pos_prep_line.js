import { patch } from "@web/core/utils/patch";
import { PosPrepLine } from "@pos_enterprise/app/models/pos_prep_line";
import { safeDurationSecondsSince, safeDurationSince, formatTimer, getTimerParts } from "../utils/utils";

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
     * Indicates whether the line is in the last stage of the preparation display.
     *
     * @returns {boolean} True if current stage is the terminal/last stage.
     */
    get isLastStage() {
        if (!this.stage_id) {
            return false;
        }
        if (this.raw?.last_stage_id && this.stage_id.id === this.raw.last_stage_id) {
            return true;
        }
        const stages = this.models?.["pos.prep.stage"]?.getAll() || [];
        if (stages.length > 0 && stages[stages.length - 1].id === this.stage_id.id) {
            return true;
        }
        return false;
    },

    /**
     * Indicates whether the line is completed (only when in the last stage).
     *
     * @returns {boolean} True if line has reached the last preparation stage.
     */
    get isCompleted() {
        return Boolean(this.isLastStage);
    },

    /**
     * Total elapsed preparation duration of this item in seconds.
     * When the item is in the last stage or completed, counting stops and freezes
     * at the duration it took to complete.
     *
     * @returns {number} Elapsed duration in seconds.
     */
    computeTotalDurationSeconds() {
        const startTime =
            this.create_date ||
            this.prep_order_id?.create_date ||
            this.prep_order_id?.pos_order_id?.date_order ||
            this.last_stage_change;

        if (this.isCompleted) {
            if (typeof this._frozenDurationSeconds === "number") {
                return this._frozenDurationSeconds;
            }
            const endTime = this.last_stage_change || this.write_date;
            if (endTime && startTime) {
                const startSec = safeDurationSecondsSince(startTime);
                const endSec = safeDurationSecondsSince(endTime);
                const duration = Math.max(0, startSec - endSec);
                if (duration > 0) {
                    this._frozenDurationSeconds = duration;
                    return duration;
                }
            }
            const currentDuration = safeDurationSecondsSince(startTime);
            this._frozenDurationSeconds = currentDuration;
            return currentDuration;
        }

        // Active line: clear any cached frozen duration
        delete this._frozenDurationSeconds;
        return safeDurationSecondsSince(startTime);
    },

    /**
     * Total elapsed preparation duration of this item in minutes.
     *
     * @returns {number} Elapsed duration in minutes.
     */
    computeTotalDuration() {
        return Math.floor(this.computeTotalDurationSeconds() / 60);
    },

    /**
     * Formatted preparation duration string (e.g. 05s, 02m15s, 01h05m20s).
     *
     * @returns {string} Formatted duration.
     */
    computeFormattedDuration() {
        return formatTimer(this.computeTotalDurationSeconds());
    },

    /**
     * Segmented timer parts (e.g. [{val: '23', unit: 'h'}, {val: '47', unit: 'm'}, {val: '56', unit: 's'}]).
     *
     * @returns {Array<{val: string, unit: string}>} Array of block objects.
     */
    computeTimerParts() {
        return getTimerParts(this.computeTotalDurationSeconds());
    },

    /**
     * Determines whether this line is currently in alert status.
     * Completed lines (last stage or todo === false) and cancelled lines never alert.
     *
     * @returns {boolean} True if active and preparation time reaches or exceeds category alert timer.
     */
    computeIsAlert() {
        if (!this.todo || this.isCancelled || this.isCompleted) {
            return false;
        }
        const timer = this.alertTimer;
        if (timer > 0) {
            return this.computeTotalDurationSeconds() >= timer * 60;
        }
        return false;
    },
});
