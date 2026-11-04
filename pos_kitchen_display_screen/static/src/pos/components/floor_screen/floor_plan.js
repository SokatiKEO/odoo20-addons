import { FloorPlan } from "@pos_restaurant/app/screens/floor_screen/floor_plan/floor_plan";
import { patch } from "@web/core/utils/patch";
import { onWillUnmount } from "@odoo/owl";
import { deserializeDateTime } from "@web/core/l10n/dates";

const { DateTime } = luxon;

patch(FloorPlan.prototype, {
    setup() {
        super.setup(...arguments);
        // Periodic ticker so that table late status updates reactively in real time
        this.lateTableTicker = setInterval(() => {
            if (this.pos) {
                this.pos.prepStageVersion++;
            }
        }, 3000);
        onWillUnmount(() => {
            clearInterval(this.lateTableTicker);
        });
    },

    /**
     * Determines whether any active order on the table has an item that is late in preparation.
     *
     * @param {Object} table - The restaurant table object.
     * @returns {boolean} True if any item or order is overdue.
     */
    isTableLate(table) {
        if (this.pos) {
            void this.pos.prepStageVersion;
        }
        if (this.state?.tableTimer && table) {
            void this.state.tableTimer[table.id];
        }

        if (!table) {
            return false;
        }

        const targetTable = table.rootTable || table;
        let orders = targetTable.getOrders
            ? targetTable.getOrders()
            : targetTable.getOrder
            ? [targetTable.getOrder()]
            : [];
        let activeOrders = orders.filter((o) => o && !o.finalized);

        if (!activeOrders.length && this.pos?.models?.["pos.order"]) {
            activeOrders = this.pos.models["pos.order"].filter(
                (o) => !o.finalized && (o.table_id?.id === table.id || o.table_id?.id === targetTable.id)
            );
        }

        if (!activeOrders.length) {
            return false;
        }

        for (const order of activeOrders) {
            for (const line of order.lines) {
                // Skip combo parent container (child lines contain preparation details)
                if (line.combo_line_ids?.length) {
                    continue;
                }
                if (line.qty <= 0) {
                    continue;
                }
                if (line.isPrepServed || line.manual_served) {
                    continue;
                }
                if (!line.isSentToKitchen) {
                    continue;
                }

                const alertTimer = this.getLineAlertTimer(line);
                if (alertTimer > 0) {
                    const elapsed = this.getLinePrepDuration(line, order);
                    if (elapsed > alertTimer) {
                        return true;
                    }
                }
            }

            // Fallback: check if the overall unserved order exceeded stage alert timer
            const unservedLines = order.lines.filter(
                (l) => l.isSentToKitchen && !l.isPrepServed && !l.manual_served && l.qty > 0
            );
            if (unservedLines.length) {
                const stage = unservedLines[0].currentPrepStage;
                if (stage?.alert_timer > 0) {
                    const orderDuration = this.getOrderDurationMinutes(order);
                    if (orderDuration > stage.alert_timer) {
                        return true;
                    }
                }
            }
        }

        return false;
    },

    /**
     * Resolves the alert timer threshold in minutes for a POS order line.
     * Checks product's POS categories and parent category hierarchy.
     */
    getLineAlertTimer(line) {
        let maxTimer = 0;
        const categories =
            line.product_id?.pos_categ_ids ||
            (line.product_id?.pos_categ_id ? [line.product_id.pos_categ_id] : []);
        for (const categ of categories) {
            let current = categ;
            const visited = new Set();
            while (current && !visited.has(current.id)) {
                visited.add(current.id);
                if (current.alert_timer > 0) {
                    maxTimer = Math.max(maxTimer, current.alert_timer);
                    break;
                }
                const parentId =
                    current.parent_id?.id ||
                    (typeof current.parent_id === "number" ? current.parent_id : null);
                current =
                    parentId && this.pos?.models?.["pos.category"]
                        ? this.pos.models["pos.category"].get(parentId)
                        : null;
            }
        }
        if (line.product_id?.parentPosCategIds && this.pos?.models?.["pos.category"]) {
            for (const categId of line.product_id.parentPosCategIds) {
                const categ = this.pos.models["pos.category"].get(categId);
                if (categ?.alert_timer > 0) {
                    maxTimer = Math.max(maxTimer, categ.alert_timer);
                }
            }
        }
        if (maxTimer === 0 && line.currentPrepStage?.alert_timer > 0) {
            maxTimer = line.currentPrepStage.alert_timer;
        }
        return maxTimer;
    },

    /**
     * Calculates preparation elapsed time in minutes for an order line.
     */
    getLinePrepDuration(line, order) {
        let prepLineCreateDate = null;
        if (line.prep_line_ids?.length) {
            const firstPrep = line.prep_line_ids[0];
            if (typeof firstPrep === "object" && firstPrep.create_date) {
                prepLineCreateDate = firstPrep.create_date;
            } else if (typeof firstPrep === "number" && this.pos?.models?.["pos.prep.line"]) {
                prepLineCreateDate = this.pos.models["pos.prep.line"].get(firstPrep)?.create_date;
            }
        }

        const startTime =
            line.prep_sent_time ||
            prepLineCreateDate ||
            line.prep_stage_change_time ||
            line.create_date ||
            order?.date_order ||
            order?.create_date;
        return this._getElapsedMinutes(startTime);
    },

    /**
     * Calculates duration in minutes for an order.
     */
    getOrderDurationMinutes(order) {
        const startTime = order?.date_order || order?.create_date;
        return this._getElapsedMinutes(startTime);
    },

    _getElapsedMinutes(val) {
        if (!val) {
            return 0;
        }
        let dt = null;
        if (DateTime.isDateTime(val)) {
            dt = val;
        } else if (val instanceof Date) {
            dt = DateTime.fromJSDate(val);
        } else if (typeof val === "string") {
            dt = deserializeDateTime(val);
            if (!dt || !dt.isValid) {
                const iso = val.includes("T") ? val : val.replace(" ", "T") + "Z";
                dt = DateTime.fromISO(iso);
            }
            if (!dt || !dt.isValid) {
                dt = DateTime.fromSQL(val, { zone: "utc" });
            }
        }
        if (!dt || !dt.isValid || typeof dt.ts !== "number") {
            return 0;
        }
        return Math.max(0, Math.floor((DateTime.now().ts - dt.ts) / 1000 / 60));
    },

    getTableFoodStages(table) {
        // Access pos.prepStageVersion to subscribe this component to real-time updates in OWL
        if (this.pos) {
            void this.pos.prepStageVersion;
        }

        if (!table) {
            return [];
        }

        const orders = table.getOrders ? table.getOrders() : (table.getOrder ? [table.getOrder()] : []);
        const activeOrders = orders.filter((o) => o && !o.finalized);
        if (!activeOrders.length) {
            return [];
        }

        // Get dynamic preparation stages sorted by sequence
        let stageModels = this.pos?.models?.["pos.prep.stage"]
            ? [...this.pos.models["pos.prep.stage"].getAll()].sort(
                (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.id - b.id
            )
            : [];

        if (!stageModels.length) {
            return [];
        }

        const firstStage = stageModels[0];
        const lastStage = stageModels[stageModels.length - 1];

        // Map stage IDs to counting buckets
        const countsByStageId = {};
        for (const stage of stageModels) {
            countsByStageId[stage.id] = 0;
        }

        for (const order of activeOrders) {
            for (const line of order.lines) {
                // Skip combo parent container to count the individual food item lines
                if (line.combo_line_ids?.length) {
                    continue;
                }

                const qty = Math.round(line.qty) || 1;
                const stage = line.currentPrepStage;

                if (stage && countsByStageId[stage.id] !== undefined) {
                    countsByStageId[stage.id] += qty;
                } else if (line.isPrepServed && lastStage) {
                    countsByStageId[lastStage.id] += qty;
                } else if (line.isPrepReady) {
                    const readyStage =
                        stageModels.find((s) => (s.name || "").toLowerCase().includes("ready")) ||
                        (stageModels.length > 2 ? stageModels[stageModels.length - 2] : (stageModels[1] || firstStage));
                    if (readyStage && countsByStageId[readyStage.id] !== undefined) {
                        countsByStageId[readyStage.id] += qty;
                    }
                } else if (line.isSentToKitchen && firstStage) {
                    countsByStageId[firstStage.id] += qty;
                }
            }
        }

        // Return array of stages with count > 0, in exact sequence order
        return stageModels
            .filter((stage) => countsByStageId[stage.id] > 0)
            .map((stage) => {
                const color = stage.color || "#60A8FF";
                const isReady =
                    stage.id !== firstStage.id && stage.id !== lastStage.id;
                return {
                    id: stage.id,
                    name: stage.name,
                    color: color,
                    textColor: this._getContrastColor(color),
                    isReady: isReady,
                    count: countsByStageId[stage.id],
                };
            });
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
});
