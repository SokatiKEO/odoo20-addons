import { PosStore } from "@point_of_sale/app/services/pos_store";
import { patch } from "@web/core/utils/patch";
import { serializeDateTime } from "@web/core/l10n/dates";

const { DateTime } = luxon;

patch(PosStore.prototype, {
    async setup() {
        await super.setup(...arguments);
        this.prepStageVersion = 0;
    },
    async afterProcessServerData() {
        const res = await super.afterProcessServerData(...arguments);
        if (this.data) {
            this.data.connectWebSocket(
                "POS_PREP_STAGE_UPDATE",
                this._onPrepStageUpdate.bind(this)
            );
        }
        return res;
    },
    _onPrepStageUpdate(payload) {
        if (!payload) {
            return;
        }
        const updates = Array.isArray(payload)
            ? payload
            : payload.updates
            ? payload.updates
            : [payload];

        for (const update of updates) {
            const { line_uuid, line_id, status, stage_id } = update;
            let line = null;
            if (line_uuid) {
                line = this.models["pos.order.line"].getBy("uuid", line_uuid);
            }
            if (!line && line_id) {
                line = this.models["pos.order.line"].get(line_id);
            }
            if (line) {
                line.prep_status = status;
                if (stage_id) {
                    line.prep_stage_id = stage_id;
                }
                if (update.stage_change_time) {
                    line.prep_stage_change_time = update.stage_change_time;
                }
                if (update.sent_time && !line.prep_sent_time) {
                    line.prep_sent_time = update.sent_time;
                }
                if (line.combo_parent_id) {
                    this._updateComboParentPrepStatus(line.combo_parent_id);
                }
            }
        }
        this.prepStageVersion++;
    },
    async sendOrderInPreparation(order, opts = {}) {
        const now = serializeDateTime(DateTime.now());
        if (order?.lines) {
            for (const line of order.lines) {
                if (line.isSentToKitchen && !line.prep_sent_time) {
                    line.prep_sent_time = now;
                    line.prep_stage_change_time = now;
                }
            }
        }
        return await super.sendOrderInPreparation(...arguments);
    },
    _updateComboParentPrepStatus(parentLine) {
        if (!parentLine || !parentLine.combo_line_ids?.length) {
            return;
        }
        const childStatuses = parentLine.combo_line_ids.map((child) => child.prep_status);
        if (childStatuses.length && childStatuses.every((s) => s === "served")) {
            parentLine.prep_status = "served";
            const lastChild = parentLine.combo_line_ids[0];
            parentLine.prep_stage_id = lastChild?.prep_stage_id || parentLine.prep_stage_id;
            parentLine.prep_stage_change_time = lastChild?.prep_stage_change_time || parentLine.prep_stage_change_time;
        } else if (childStatuses.some((s) => s === "ready")) {
            parentLine.prep_status = "ready";
            const readyChild = parentLine.combo_line_ids.find((c) => c.prep_status === "ready");
            parentLine.prep_stage_id = readyChild?.prep_stage_id || parentLine.prep_stage_id;
            parentLine.prep_stage_change_time = readyChild?.prep_stage_change_time || parentLine.prep_stage_change_time;
        } else {
            parentLine.prep_status = false;
        }
    },
});
