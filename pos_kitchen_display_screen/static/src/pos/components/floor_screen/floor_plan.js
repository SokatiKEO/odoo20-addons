import { FloorPlan } from "@pos_restaurant/app/screens/floor_screen/floor_plan/floor_plan";
import { patch } from "@web/core/utils/patch";

patch(FloorPlan.prototype, {
    getTableFoodStages(table) {
        // Access pos.prepStageVersion to subscribe this component to real-time updates in OWL
        if (this.pos) {
            void this.pos.prepStageVersion;
        }

        if (!table) {
            return { hasFood: false, pending: 0, ready: 0, served: 0 };
        }

        const orders = table.getOrders ? table.getOrders() : (table.getOrder ? [table.getOrder()] : []);
        const activeOrders = orders.filter((o) => o && !o.finalized);
        if (!activeOrders.length) {
            return { hasFood: false, pending: 0, ready: 0, served: 0 };
        }

        let pending = 0;
        let ready = 0;
        let served = 0;

        for (const order of activeOrders) {
            for (const line of order.lines) {
                // Skip combo parent container to count the individual food item lines
                if (line.combo_line_ids?.length) {
                    continue;
                }

                const qty = Math.round(line.qty) || 1;

                if (line.isPrepServed) {
                    served += qty;
                } else if (line.isPrepReady) {
                    ready += qty;
                } else {
                    pending += qty;
                }
            }
        }

        return {
            hasFood: pending > 0 || ready > 0 || served > 0,
            pending,
            ready,
            served,
        };
    },
});

