import { patch } from "@web/core/utils/patch";
import { Order } from "@pos_enterprise/app/components/order/order";

patch(Order.prototype, {
    get tableName() {
        return this.order?.pos_order_id?.table_name || "";
    },

    get order_name() {
        if (this.tableName) {
            return this.tableName;
        }
        const posOrder = this.order?.pos_order_id;
        const table = posOrder?.table_id;
        if (table) {
            const tName = table.table_name || "";
            const tNumber = table.table_number != null ? String(table.table_number) : "";
            const floorName = table.floor_id?.name || "";
            const label = tName.trim() || tNumber.trim();
            if (label) {
                return floorName ? `${label} (${floorName})` : label;
            }
        }
        return super.order_name;
    },

    get tickedPrepLines() {
        return (this.props.order?.prepLines || []).filter((pl) => pl.todo === false);
    },

    get hasTickedLines() {
        const isLastStage = this.prepDisplay?.lastStage?.id === this.props.order?.stage?.id;
        return !isLastStage && this.tickedPrepLines.length > 0;
    },

    get nextStage() {
        const currentStageId = this.props.order?.stage?.id;
        return currentStageId ? this.prepDisplay?.orderNextStage(currentStageId, 1) : false;
    },

    get moveTickedButtonLabel() {
        const count = this.tickedPrepLines.length;
        const nextName = this.nextStage?.name;
        return nextName ? `Move to ${nextName} (${count})` : `Next Stage (${count})`;
    },

    async moveTickedLinesToNextStage() {
        if (this.actionInProgress) {
            return;
        }
        const tickedLines = this.tickedPrepLines;
        if (!tickedLines.length) {
            return;
        }
        try {
            this.actionInProgress = true;
            const nextStage = this.nextStage;
            await this.prepDisplay.changeStateStage(tickedLines, 1);
            if (nextStage) {
                const now = luxon.DateTime.now();
                for (const line of tickedLines) {
                    line.stage_id = nextStage;
                    line.todo = true;
                    line.last_stage_change = now;
                }
                this.prepDisplay.computeOrderCounts();
            }
        } finally {
            this.actionInProgress = false;
        }
    },
});
