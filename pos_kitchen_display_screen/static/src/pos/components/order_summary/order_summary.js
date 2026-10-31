import { OrderSummary } from "@point_of_sale/app/screens/product_screen/order_summary/order_summary";
import { patch } from "@web/core/utils/patch";

patch(OrderSummary.prototype, {
    async _setValue(val) {
        const { numpadMode } = this.pos;
        let selectedLine = this.currentOrder?.getSelectedOrderline();
        if (selectedLine && numpadMode === "quantity" && val !== "remove") {
            if (selectedLine.combo_parent_id) {
                selectedLine = selectedLine.combo_parent_id;
            }
            if (selectedLine.isProgressedPrepStage) {
                const parsedVal = typeof val === "number" ? val : parseFloat("" + (val ? val : 0));
                if (!isNaN(parsedVal) && parsedVal > selectedLine.qty) {
                    const extraQty = parsedVal - selectedLine.qty;
                    await this.pos.addLineToCurrentOrder({
                        product_tmpl_id: selectedLine.product_id.product_tmpl_id,
                        product_id: selectedLine.product_id,
                        qty: extraQty,
                    });
                    this.numberBuffer.reset();
                    return;
                }
            }
        }
        return super._setValue(...arguments);
    },
});

