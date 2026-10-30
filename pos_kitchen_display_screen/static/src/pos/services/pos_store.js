import { PosStore } from "@point_of_sale/app/services/pos_store";
import { patch } from "@web/core/utils/patch";

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
        if (this.models?.["pos.order.line"]) {
            this.models["pos.order.line"].addEventListener("update", () => {
                this.prepStageVersion++;
            });
            this.models["pos.order.line"].addEventListener("create", () => {
                this.prepStageVersion++;
            });
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
            const { line_uuid, line_id, status } = update;
            let line = null;
            if (line_uuid) {
                line = this.models["pos.order.line"].getBy("uuid", line_uuid);
            }
            if (!line && line_id) {
                line = this.models["pos.order.line"].get(line_id);
            }
            if (line) {
                line.prep_status = status;
                if (line.combo_parent_id) {
                    this._updateComboParentPrepStatus(line.combo_parent_id);
                }
            }
        }
        this.prepStageVersion++;
    },
    _updateComboParentPrepStatus(parentLine) {
        if (!parentLine || !parentLine.combo_line_ids?.length) {
            return;
        }
        const childStatuses = parentLine.combo_line_ids.map((child) => child.prep_status);
        if (childStatuses.length && childStatuses.every((s) => s === "served")) {
            parentLine.prep_status = "served";
        } else if (childStatuses.some((s) => s === "ready")) {
            parentLine.prep_status = "ready";
        } else {
            parentLine.prep_status = false;
        }
    },
});
