import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { patch } from "@web/core/utils/patch";

patch(PosOrderline.prototype, {
    setup() {
        super.setup(...arguments);
        this.prep_status = this.prep_status || false;
        this.manual_served = this.manual_served || false;
    },
    get isSentToKitchen() {
        if (this.combo_line_ids?.length) {
            return this.combo_line_ids.some((child) => child.isSentToKitchen);
        }

        if (this.prep_status === "ready") {
            return true;
        }

        const prepCategories = this.config?.preparationCategories || this.order_id?.config?.preparationCategories;
        if (!prepCategories || prepCategories.size === 0) {
            return false;
        }

        const product = this.product_id;
        if (product?.parentPosCategIds?.some((id) => prepCategories.has(id))) {
            return true;
        }

        return false;
    },
    get isPrepReady() {
        if (this.combo_line_ids?.length) {
            return !this.isPrepServed && this.combo_line_ids.some((child) => child.isPrepReady);
        }
        return this.prep_status === "ready";
    },
    get isPrepServed() {
        if (this.manual_served) {
            return true;
        }
        if (this.combo_line_ids?.length) {
            return this.combo_line_ids.every((child) => child.isPrepServed);
        }
        return this.prep_status === "served";
    },
    toggleServed() {
        // Disallow cashier from toggling serve / un-serve on items sent to the kitchen
        if (this.isSentToKitchen) {
            return;
        }

        const nextState = !this.isPrepServed;
        this.manual_served = nextState;
        this.prep_status = nextState ? "served" : false;

        // If this is a combo parent line, toggle any non-kitchen combo children
        if (this.combo_line_ids?.length) {
            for (const child of this.combo_line_ids) {
                if (!child.isSentToKitchen) {
                    child.manual_served = nextState;
                    child.prep_status = nextState ? "served" : false;
                }
            }
        }

        // If this is a combo child, update its parent combo status
        if (this.combo_parent_id) {
            const parent = this.combo_parent_id;
            const allChildrenServed = parent.combo_line_ids.every((c) => c.isPrepServed);
            parent.manual_served = allChildrenServed;
            parent.prep_status = allChildrenServed
                ? "served"
                : parent.combo_line_ids.some((c) => c.isPrepReady)
                ? "ready"
                : false;
        }

        if (this.order_id) {
            this.order_id.uiState.booked = true;
        }
    },
    getDisplayClasses() {
        return {
            ...super.getDisplayClasses(),
            "pos-prep-ready": this.isPrepReady,
            "pos-prep-served": this.isPrepServed,
        };
    },
});
