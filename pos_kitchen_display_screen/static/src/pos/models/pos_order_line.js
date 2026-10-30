import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { patch } from "@web/core/utils/patch";

patch(PosOrderline.prototype, {
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
    get currentPrepStage() {
        let stageModels = this.models?.["pos.prep.stage"]
            ? [...this.models["pos.prep.stage"].getAll()].sort((a, b) => a.sequence - b.sequence)
            : [];
        if (!stageModels.length) {
            stageModels = [
                { id: 1, name: "To cook", color: "#C8C9CB", sequence: 0 },
                { id: 2, name: "Ready", color: "#60A8FF", sequence: 1 },
                { id: 3, name: "Completed", color: "#59C629", sequence: 2 },
            ];
        }

        const firstStage = stageModels[0];
        const lastStage = stageModels[stageModels.length - 1];

        // For combo parent lines, aggregate from child lines
        if (this.combo_line_ids?.length) {
            const childStages = this.combo_line_ids
                .map((c) => c.currentPrepStage)
                .filter(Boolean);
            if (!childStages.length) {
                return null;
            }
            if (childStages.every((s) => s.id === lastStage.id)) {
                return lastStage;
            }
            childStages.slice().sort((a, b) => a.sequence - b.sequence);
            return childStages[0];
        }

        if (this.manual_served || this.prep_status === "served") {
            return lastStage;
        }

        if (this.prep_stage_id) {
            const stage =
                this.models?.["pos.prep.stage"]?.get(this.prep_stage_id) ||
                stageModels.find((s) => s.id === this.prep_stage_id);
            if (stage) {
                return stage;
            }
        }

        if (this.isPrepReady) {
            return (
                stageModels.find((s) => s.name?.toLowerCase().includes("ready")) ||
                stageModels[1] ||
                firstStage
            );
        }

        if (this.isSentToKitchen) {
            return firstStage;
        }

        return null;
    },
    get prepStageDisplay() {
        const stage = this.currentPrepStage;
        if (!stage) {
            return null;
        }
        const color = stage.color || "#60A8FF";
        return {
            id: stage.id,
            name: stage.name,
            color: color,
            textColor: this._getContrastColor(color),
            isLast: this.isPrepServed,
            isReady: this.isPrepReady,
        };
    },
    _getContrastColor(hexColor) {
        if (!hexColor || !hexColor.startsWith("#") || hexColor.length < 7) {
            return "#ffffff";
        }
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 155 ? "#1a1a1a" : "#ffffff";
    },
    toggleServed() {
        // Disallow cashier from toggling serve / un-serve on items sent to the kitchen
        if (this.isSentToKitchen) {
            return;
        }

        const nextState = !this.isPrepServed;
        this.manual_served = nextState;
        this.prep_status = nextState ? "served" : false;

        let stageModels = this.models?.["pos.prep.stage"]
            ? [...this.models["pos.prep.stage"].getAll()].sort((a, b) => a.sequence - b.sequence)
            : [];
        if (!stageModels.length) {
            stageModels = [
                { id: 1, name: "To cook", color: "#C8C9CB", sequence: 0 },
                { id: 2, name: "Ready", color: "#60A8FF", sequence: 1 },
                { id: 3, name: "Completed", color: "#59C629", sequence: 2 },
            ];
        }
        const lastStage = stageModels[stageModels.length - 1];
        this.prep_stage_id = nextState && lastStage ? lastStage.id : false;

        // If this is a combo parent line, toggle any non-kitchen combo children
        if (this.combo_line_ids?.length) {
            for (const child of this.combo_line_ids) {
                if (!child.isSentToKitchen) {
                    child.manual_served = nextState;
                    child.prep_status = nextState ? "served" : false;
                    child.prep_stage_id = nextState && lastStage ? lastStage.id : false;
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
            parent.prep_stage_id = allChildrenServed && lastStage ? lastStage.id : false;
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
