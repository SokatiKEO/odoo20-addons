import { onMounted, onPatched } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { PrepDisplay } from "@pos_enterprise/app/components/preparation_display/preparation_display";

patch(PrepDisplay.prototype, {
    setup() {
        super.setup(...arguments);
        onMounted(() => {
            this._notifyManagerParent();
        });
        onPatched(() => {
            this._notifyManagerParent();
        });
    },

    get isReadOnly() {
        return Boolean(this.prepDisplay?.isReadOnly);
    },

    get isEmbed() {
        return Boolean(this.prepDisplay?.isEmbed);
    },

    _notifyManagerParent() {
        if (!this.isEmbed || !window.parent || window.parent === window) {
            return;
        }
        try {
            const activeLines = this.prepDisplay.activeLines || [];
            const uniqueOrderIds = new Set(
                activeLines
                    .filter((line) => this.prepDisplay.checkStateVisibility(line))
                    .map((line) => line.prep_order_id?.id)
                    .filter(Boolean)
            );
            window.parent.postMessage(
                {
                    type: "PDIS_MANAGER_SCREEN_STATS",
                    displayId: this.prepDisplay.id,
                    orderCount: uniqueOrderIds.size,
                    cardCount: this.prepDisplay.filteredOrders
                        ? this.prepDisplay.filteredOrders.length
                        : 0,
                    lineCount: activeLines.length,
                },
                window.location.origin
            );
        } catch {
            // Ignore cross-frame messaging errors during teardown
        }
    },

    archiveAllVisibleOrders() {
        if (this.isReadOnly) {
            return;
        }
        return super.archiveAllVisibleOrders(...arguments);
    },

    recallLastChange() {
        if (this.isReadOnly) {
            return;
        }
        return super.recallLastChange(...arguments);
    },

    async _barcodeProductAction() {
        if (this.isReadOnly) {
            return;
        }
        return super._barcodeProductAction(...arguments);
    },
});
