import { patch } from "@web/core/utils/patch";
import { PrepDisplay as PrepDisplayService } from "@pos_enterprise/app/services/preparation_display_service";

const SYNC_CHANNEL_NAME = "pos_prep_display_sync";

patch(PrepDisplayService.prototype, {
    async setup() {
        this.isReadOnly = Boolean(odoo.preparation_display?.is_readonly);
        this.isEmbed = Boolean(odoo.preparation_display?.is_embed);
        this._isFetchingOrders = false;
        await super.setup(...arguments);
        this._setupRealtimeSync();
    },

    _setupRealtimeSync() {
        if (typeof BroadcastChannel !== "undefined") {
            try {
                this._syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
                this._syncChannel.addEventListener("message", (event) => {
                    if (event.data?.type === "REFRESH_ORDERS") {
                        this._safeRefreshOrders();
                    }
                });
            } catch {
                // Ignore if BroadcastChannel is restricted
            }
        }

        if (this.isReadOnly || this.isEmbed) {
            this._pollIntervalId = setInterval(() => {
                if (document.visibilityState !== "hidden") {
                    this._safeRefreshOrders();
                }
            }, 3000);
        }
    },

    _broadcastSync() {
        if (this._syncChannel) {
            try {
                this._syncChannel.postMessage({
                    type: "REFRESH_ORDERS",
                    displayId: this.id,
                    ts: Date.now(),
                });
            } catch {
                // Ignore BroadcastChannel errors
            }
        }
    },

    async _safeRefreshOrders() {
        if (this._isFetchingOrders) {
            return;
        }
        this._isFetchingOrders = true;
        try {
            await this.getPreparationDisplayOrder(null);
        } catch {
            // Ignore transient polling errors
        } finally {
            this._isFetchingOrders = false;
        }
    },

    async syncStateStatus() {
        if (this.isReadOnly) {
            return;
        }
        const res = await super.syncStateStatus(...arguments);
        this._broadcastSync();
        return res;
    },

    async doneOrders() {
        if (this.isReadOnly) {
            return;
        }
        const res = await super.doneOrders(...arguments);
        await this._safeRefreshOrders();
        this._broadcastSync();
        return res;
    },

    async changeStateStage() {
        if (this.isReadOnly) {
            return;
        }
        const res = await super.changeStateStage(...arguments);
        await this._safeRefreshOrders();
        this.stageChangedOrderIds = [];
        this._broadcastSync();
        return res;
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
        const res = await super.moveAllOrdersToNextStage(...arguments);
        await this._safeRefreshOrders();
        this._broadcastSync();
        return res;
    },

    async resetOrders() {
        if (this.isReadOnly) {
            return;
        }
        const res = await super.resetOrders(...arguments);
        this._broadcastSync();
        return res;
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
