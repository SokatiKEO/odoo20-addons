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
            const { line_uuid, line_id, order_id, order_uuid, status, stage_id } = update;
            let line = null;

            if (line_uuid) {
                line =
                    this.models?.["pos.order.line"]?.getBy?.("uuid", line_uuid) ||
                    this.models?.["pos.order.line"]?.getAll?.()?.find?.((l) => l.uuid === line_uuid);
            }
            if (!line && line_id) {
                line =
                    this.models?.["pos.order.line"]?.get?.(line_id) ||
                    this.models?.["pos.order.line"]?.getAll?.()?.find?.((l) => l.id === line_id);
            }
            if (!line && (order_uuid || order_id)) {
                const order =
                    (order_uuid &&
                        (this.models?.["pos.order"]?.getBy?.("uuid", order_uuid) ||
                            this.models?.["pos.order"]?.getAll?.()?.find?.((o) => o.uuid === order_uuid))) ||
                    (order_id &&
                        (this.models?.["pos.order"]?.get?.(order_id) ||
                            this.models?.["pos.order"]?.getAll?.()?.find?.((o) => o.id === order_id)));
                if (order && order.lines?.length) {
                    if (line_uuid) {
                        line = order.lines.find((l) => l.uuid === line_uuid);
                    }
                    if (!line && line_id) {
                        line = order.lines.find((l) => l.id === line_id);
                    }
                }
            }

            if (line) {
                line.prep_status = status;
                if (update.manual_served !== undefined) {
                    line.manual_served = update.manual_served;
                } else if (status === "served") {
                    line.manual_served = true;
                } else if (status === false) {
                    line.manual_served = false;
                }
                if (stage_id) {
                    line.prep_stage_id = stage_id;
                }
                if (update.stage_name) {
                    line.prep_stage_name = update.stage_name;
                }
                if (update.stage_color) {
                    line.prep_stage_color = update.stage_color;
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
        const stageModels = this.models?.["pos.prep.stage"]
            ? [...this.models["pos.prep.stage"].getAll()].sort(
                (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.id - b.id
            )
            : [];
        const firstStage = stageModels[0];

        if (order?.lines) {
            for (const line of order.lines) {
                if (line.isSentToKitchen) {
                    if (!line.prep_sent_time) {
                        line.prep_sent_time = now;
                    }
                    if (!line.prep_stage_change_time) {
                        line.prep_stage_change_time = now;
                    }
                    if (!line.prep_stage_id && firstStage) {
                        line.prep_stage_id = firstStage.id;
                        line.prep_stage_name = firstStage.name;
                        line.prep_stage_color = firstStage.color;
                    }
                }
            }
        }
        return await super.sendOrderInPreparation(...arguments);
    },
    async addLineToOrder(vals, order, opts = {}, configure = true) {
        const line = await super.addLineToOrder(...arguments);
        if (order && order.table_id && order.isSynced) {
            order.uiState.booked = true;
            this.addPendingOrder([order.id]);
            this.syncAllOrdersDebounced?.();
        }
        return line;
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
            parentLine.prep_stage_name = lastChild?.prep_stage_name || parentLine.prep_stage_name;
            parentLine.prep_stage_color = lastChild?.prep_stage_color || parentLine.prep_stage_color;
            parentLine.prep_stage_change_time = lastChild?.prep_stage_change_time || parentLine.prep_stage_change_time;
        } else if (childStatuses.some((s) => s === "ready")) {
            parentLine.prep_status = "ready";
            const readyChild = parentLine.combo_line_ids.find((c) => c.prep_status === "ready");
            parentLine.prep_stage_id = readyChild?.prep_stage_id || parentLine.prep_stage_id;
            parentLine.prep_stage_name = readyChild?.prep_stage_name || parentLine.prep_stage_name;
            parentLine.prep_stage_color = readyChild?.prep_stage_color || parentLine.prep_stage_color;
            parentLine.prep_stage_change_time = readyChild?.prep_stage_change_time || parentLine.prep_stage_change_time;
        } else {
            parentLine.prep_status = false;
            const inProgressChild = parentLine.combo_line_ids.find((c) => c.prep_stage_id);
            if (inProgressChild) {
                parentLine.prep_stage_id = inProgressChild.prep_stage_id;
                parentLine.prep_stage_name = inProgressChild.prep_stage_name;
                parentLine.prep_stage_color = inProgressChild.prep_stage_color;
            }
        }
    },
});
