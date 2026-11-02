import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { patch } from "@web/core/utils/patch";
import { deserializeDateTime, serializeDateTime } from "@web/core/l10n/dates";

const { DateTime } = luxon;

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
    _getSortedPrepStages() {
        if (this.models?.["pos.prep.stage"]) {
            const stages = this.models["pos.prep.stage"].getAll();
            if (stages && stages.length > 0) {
                return [...stages].sort(
                    (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.id - b.id
                );
            }
        }
        if (this.models?.["pos.prep.display"]) {
            const displays = this.models["pos.prep.display"].getAll();
            const stages = [];
            for (const disp of displays) {
                if (disp.stage_ids?.length) {
                    for (const s of disp.stage_ids) {
                        const stageObj = typeof s === "object" ? s : this.models?.["pos.prep.stage"]?.get(s);
                        if (stageObj && !stages.some((existing) => existing.id === stageObj.id)) {
                            stages.push(stageObj);
                        }
                    }
                }
            }
            if (stages.length > 0) {
                return stages.sort(
                    (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.id - b.id
                );
            }
        }
        return [];
    },
    get isProgressedPrepStage() {
        if (this.manual_served || this.isPrepServed) {
            return true;
        }
        if (this.isPrepReady || this.prep_status === "ready") {
            return true;
        }
        if (this.combo_line_ids?.length) {
            return this.combo_line_ids.some((child) => child.isProgressedPrepStage);
        }
        const stage = this.currentPrepStage;
        if (!stage) {
            return false;
        }
        const stageModels = this._getSortedPrepStages();
        const firstStage = stageModels[0];
        if (firstStage && stage.id !== firstStage.id) {
            return true;
        }
        return false;
    },
    canBeMergedWith(orderline) {
        if (this.isProgressedPrepStage || orderline.isProgressedPrepStage) {
            return false;
        }
        if (this.currentPrepStage?.id !== orderline.currentPrepStage?.id) {
            return false;
        }
        return super.canBeMergedWith(orderline);
    },
    setQuantity(quantity, keep_price) {
        const quant =
            typeof quantity === "number" ? quantity : parseFloat("" + (quantity ? quantity : 0));

        // When a line is in a progressed preparation stage and quantity is increased,
        // split the extra quantity into a new orderline in the initial stage
        if (quant > this.qty && this.isProgressedPrepStage && this.order_id) {
            const extraQty = quant - this.qty;
            const order = this.order_id;
            const newLine = this.models["pos.order.line"].create({
                product_id: this.product_id,
                order_id: order,
                qty: extraQty,
                price_unit: this.price_unit,
                discount: this.discount,
                customer_note: this.customer_note,
                note: this.note,
            });
            if (this.combo_line_ids?.length) {
                for (const child of this.combo_line_ids) {
                    this.models["pos.order.line"].create({
                        product_id: child.product_id,
                        order_id: order,
                        combo_parent_id: newLine,
                        combo_item_id: child.combo_item_id,
                        qty: (child.qty / this.qty) * extraQty,
                        price_unit: child.price_unit,
                        note: child.note,
                        customer_note: child.customer_note,
                    });
                }
            }
            order.selectOrderline(newLine);
            const pos = order.pos || this.models["pos.order.line"].env?.services?.pos;
            if (pos?.numberBuffer) {
                pos.numberBuffer.reset();
            }
            return true;
        }

        return super.setQuantity(quantity, keep_price);
    },
    get currentPrepStage() {
        const stageModels = this._getSortedPrepStages();
        const firstStage = stageModels[0] || null;
        const lastStage = stageModels.length ? stageModels[stageModels.length - 1] : null;

        // For combo parent lines, aggregate from child lines
        if (this.combo_line_ids?.length) {
            const childStages = this.combo_line_ids
                .map((c) => c.currentPrepStage)
                .filter(Boolean);
            if (!childStages.length) {
                return null;
            }
            if (lastStage && childStages.every((s) => s.id === lastStage.id)) {
                return lastStage;
            }
            childStages.slice().sort(
                (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.id - b.id
            );
            return childStages[0];
        }

        if (this.manual_served || this.prep_status === "served") {
            if (lastStage) {
                return lastStage;
            }
            return {
                id: null,
                name: this.prep_stage_name || "",
                color: this.prep_stage_color || "#59C629",
                sequence: 9999,
            };
        }

        const stageId = typeof this.prep_stage_id === "object" ? this.prep_stage_id?.id : this.prep_stage_id;
        if (stageId) {
            const stage =
                this.models?.["pos.prep.stage"]?.get?.(stageId) ||
                stageModels.find((s) => s.id === stageId);
            if (stage) {
                return stage;
            }
            if (this.prep_stage_name) {
                return {
                    id: stageId,
                    name: this.prep_stage_name,
                    color: this.prep_stage_color || "#C8C9CB",
                    sequence: 0,
                };
            }
        }

        if (this.prep_stage_name) {
            const stageByName = stageModels.find((s) => s.name === this.prep_stage_name);
            if (stageByName) {
                return stageByName;
            }
            return {
                id: stageId || null,
                name: this.prep_stage_name,
                color: this.prep_stage_color || "#C8C9CB",
                sequence: 0,
            };
        }

        if (this.isPrepReady) {
            const readyStage = stageModels.find((s) => (s.name || "").toLowerCase().includes("ready"));
            if (readyStage) {
                return readyStage;
            }
            if (stageModels.length > 2) {
                return stageModels[stageModels.length - 2];
            }
            if (stageModels.length > 1) {
                return stageModels[1];
            }
            return firstStage;
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
    get orderLineStyle() {
        const stage = this.prepStageDisplay;
        if (!stage) {
            return "";
        }
        return `border-left: 5px solid ${stage.color} !important; background-color: ${stage.color}18;`;
    },
    _formatTime(val) {
        if (!val) {
            return "";
        }
        let dt;
        if (DateTime.isDateTime(val) || val.isLuxonDateTime || (typeof val === "object" && val.isValid)) {
            dt = val;
        } else if (typeof val === "string") {
            if (val.includes("T") || val.endsWith("Z")) {
                dt = DateTime.fromISO(val);
            } else {
                dt = deserializeDateTime(val);
            }
        } else if (val instanceof Date) {
            dt = DateTime.fromJSDate(val);
        }
        if (dt && dt.isValid) {
            return dt.toLocaleString(DateTime.TIME_WITH_SECONDS);
        }
        return "";
    },
    get prepStageTimeDisplay() {
        if (this.combo_line_ids?.length) {
            const times = this.combo_line_ids.map((c) => c.prepStageTimeDisplay).filter(Boolean);
            return times[0] || "";
        }
        return this._formatTime(
            this.prep_stage_change_time ||
            this.prep_sent_time ||
            this.prep_line_ids?.[0]?.last_stage_change ||
            this.prep_line_ids?.[0]?.create_date
        );
    },
    get prepSentTimeDisplay() {
        if (this.combo_line_ids?.length) {
            const times = this.combo_line_ids.map((c) => c.prepSentTimeDisplay).filter(Boolean);
            return times[0] || "";
        }
        return this._formatTime(this.prep_sent_time || this.prep_line_ids?.[0]?.create_date);
    },
    get prepStageChangeTimeDisplay() {
        if (this.combo_line_ids?.length) {
            const times = this.combo_line_ids.map((c) => c.prepStageChangeTimeDisplay).filter(Boolean);
            return times[0] || "";
        }
        return this._formatTime(this.prep_stage_change_time || this.prep_line_ids?.[0]?.last_stage_change);
    },
    get cashierName() {
        if (this.combo_parent_id) {
            return this.combo_parent_id.cashierName;
        }
        const order = this.order_id;
        const pos = order?.pos || this.models?.["pos.order.line"]?.env?.services?.pos;
        return (
            order?.cashier_name ||
            order?.employee_id?.name ||
            order?.user_id?.name ||
            order?.getCashierName?.() ||
            pos?.accessRight?.loggedCashier?.name ||
            pos?.user?.name ||
            ""
        );
    },
    get prepStageTooltip() {
        const stage = this.prepStageDisplay;
        if (!stage) {
            return "";
        }
        const parts = [stage.name];
        if (this.prepStageTimeDisplay) {
            parts.push(this.prepStageTimeDisplay);
        }
        if (this.cashierName) {
            parts.push(this.cashierName);
        }
        return parts.join(" • ");
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
        if (this.isSentToKitchen) {
            return;
        }

        const nextState = !this.isPrepServed;
        const now = serializeDateTime(DateTime.now());
        const stageModels = this._getSortedPrepStages();
        const lastStage = stageModels.length ? stageModels[stageModels.length - 1] : null;

        this.manual_served = nextState;
        this.prep_status = nextState ? "served" : false;
        this.prep_stage_change_time = nextState ? now : false;
        if (!this.prep_sent_time) {
            this.prep_sent_time = now;
        }
        this.prep_stage_id = nextState && lastStage ? lastStage.id : false;
        this.prep_stage_name = nextState && lastStage ? lastStage.name : false;
        this.prep_stage_color = nextState && lastStage ? lastStage.color : false;

        // If this is a combo parent line, toggle any non-kitchen combo children
        if (this.combo_line_ids?.length) {
            for (const child of this.combo_line_ids) {
                if (!child.isSentToKitchen) {
                    child.manual_served = nextState;
                    child.prep_status = nextState ? "served" : false;
                    child.prep_stage_id = nextState && lastStage ? lastStage.id : false;
                    child.prep_stage_name = nextState && lastStage ? lastStage.name : false;
                    child.prep_stage_color = nextState && lastStage ? lastStage.color : false;
                    child.prep_stage_change_time = nextState ? now : false;
                    if (!child.prep_sent_time) {
                        child.prep_sent_time = now;
                    }
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
            parent.prep_stage_name = allChildrenServed && lastStage ? lastStage.name : false;
            parent.prep_stage_color = allChildrenServed && lastStage ? lastStage.color : false;
            parent.prep_stage_change_time = now;
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
