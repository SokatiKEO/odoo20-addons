import { FloorPlan } from "@pos_restaurant/app/screens/floor_screen/floor_plan/floor_plan";
import { patch } from "@web/core/utils/patch";

patch(FloorPlan.prototype, {
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

        // Get dynamic preparation stages sorted by sequence with safe fallback
        let stageModels = this.pos?.models?.["pos.prep.stage"]
            ? [...this.pos.models["pos.prep.stage"].getAll()].sort((a, b) => a.sequence - b.sequence)
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
                } else if (line.isPrepServed) {
                    countsByStageId[lastStage.id] += qty;
                } else if (line.isPrepReady) {
                    const readyStage =
                    stageModels.length > 2
                        ? stageModels[stageModels.length - 2]
                        : (stageModels[1] || firstStage);
                    countsByStageId[readyStage.id] += qty;
                } else if (line.isSentToKitchen) {
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
