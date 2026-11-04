import { patch } from "@web/core/utils/patch";
import { PrepDisplay as PrepDisplayService } from "@pos_enterprise/app/services/preparation_display_service";

patch(PrepDisplayService.prototype, {
    async setup() {
        this.isReadOnly = Boolean(odoo.preparation_display?.is_readonly);
        this.isEmbed = Boolean(odoo.preparation_display?.is_embed);
        await super.setup(...arguments);
        this._notifyManagerParent();
    },

    computeOrderCounts() {
        super.computeOrderCounts(...arguments);
        this._notifyManagerParent();
    },

    _notifyManagerParent() {
        if (!this.isEmbed || !window.parent || window.parent === window) {
            return;
        }
        try {
            const activeLines = this.activeLines || [];
            const uniqueOrderIds = new Set(
                activeLines
                    .filter((line) => this.checkStateVisibility(line))
                    .map((line) => line.prep_order_id?.id)
                    .filter(Boolean)
            );
            window.parent.postMessage(
                {
                    type: "PDIS_MANAGER_SCREEN_STATS",
                    displayId: this.id,
                    orderCount: uniqueOrderIds.size,
                    cardCount: this.filteredOrders ? this.filteredOrders.length : 0,
                    lineCount: activeLines.length,
                },
                window.location.origin
            );
        } catch {
            // Ignore cross-frame messaging errors during teardown
        }
    },

    async syncStateStatus() {
        if (this.isReadOnly) {
            return;
        }
        return super.syncStateStatus(...arguments);
    },

    async doneOrders() {
        if (this.isReadOnly) {
            return;
        }
        return super.doneOrders(...arguments);
    },

    async changeStateStage() {
        if (this.isReadOnly) {
            return;
        }
        return super.changeStateStage(...arguments);
    },

    async changeStateStageAnimation() {
        if (this.isReadOnly) {
            return;
        }
        return super.changeStateStageAnimation(...arguments);
    },

    async clearAllOrders() {
        if (this.isReadOnly) {
            return;
        }
        return super.clearAllOrders(...arguments);
    },

    async moveAllOrdersToNextStage() {
        if (this.isReadOnly) {
            return;
        }
        return super.moveAllOrdersToNextStage(...arguments);
    },

    async resetOrders() {
        if (this.isReadOnly) {
            return;
        }
        return super.resetOrders(...arguments);
    },

    async printPreparationTicket() {
        if (this.isReadOnly) {
            return;
        }
        return super.printPreparationTicket(...arguments);
    },

    async assignBarcode() {
        if (this.isReadOnly) {
            return;
        }
        return super.assignBarcode(...arguments);
    },
});

