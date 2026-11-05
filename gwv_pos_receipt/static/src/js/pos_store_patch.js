/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { OrderReceipt } from "@point_of_sale/app/screens/receipt_screen/receipt/order_receipt";
import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { formatDateTime } from "@web/core/l10n/dates";
const { DateTime } = luxon;

patch(PosStore.prototype, {
    /**
     * Provide extra order metadata (Order Time, Cashier, Invoice/Order name)
     * for kitchen ticket / OrderChangeReceipt printing.
     */
    getPrintingChanges(order, diningModeUpdate) {
        const result = super.getPrintingChanges(...arguments);
        let orderTime = "";
        try {
            orderTime = formatDateTime(DateTime.now());
        } catch (e) {
            const now = new Date();
            orderTime = now.toLocaleString();
        }

        const cashierName =
            order?.getCashierName?.() ||
            order?.employee_id?.name ||
            order?.user_id?.name ||
            this.get_cashier?.()?.name ||
            result.employee_name ||
            "";
        const orderName = order?.getOrderSequenceName?.() || "";

        return {
            ...result,
            order_time: orderTime,
            cashier_name: cashierName,
            order_name: orderName,
        };
    },

    /**
     * Sync the draft order to the backend if it has not yet received its
     * official pos.order sequence name (e.g. "Restaurant/0003").
     */
    async _ensureOrderSequenceName(order) {
        if (!order || !order.lines?.length || this.data?.network?.offline) {
            return;
        }
        const rawName = (order.name || "").trim();
        const needsSync =
            typeof order.id !== "number" ||
            !rawName ||
            rawName === "/" ||
            /\d{5}-\d{3}-\d{4}/.test(rawName);
        if (needsSync) {
            try {
                await this.syncAllOrders({ orders: [order] });
            } catch (e) {
                console.warn("Could not sync order for sequence name:", e);
            }
        }
    },

    async sendOrderInPreparation(order, cancelled = false) {
        if (!cancelled) {
            await this._ensureOrderSequenceName(order || this.get_order());
        }
        return await super.sendOrderInPreparation(...arguments);
    },
    async afterProcessServerData() {
        await super.afterProcessServerData(...arguments);
        const currentOrder = this.get_order();
        if (currentOrder && !currentOrder.finalized) {
            this._applyOrderDefaults(currentOrder);
        }
    },

    createNewOrder(data = {}) {
        const order = super.createNewOrder(...arguments);
        this._applyOrderDefaults(order, data);
        return order;
    },

    _applyOrderDefaults(order, data = {}) {
        if (!order || order.finalized) {
            return;
        }

        // Apply default POS customer if none is set
        if (!order.get_partner() && this.config.default_partner_id) {
            let partner = null;
            const defaultPartner = this.config.default_partner_id;
            if (typeof defaultPartner === "object" && defaultPartner.id) {
                partner = defaultPartner;
            } else if (typeof defaultPartner === "number") {
                partner = this.models["res.partner"].get(defaultPartner);
            }

            if (partner) {
                order.set_partner(partner);
            }
        }

        // Apply default invoice state if configured
        if (this.config.default_to_invoice && data.to_invoice === undefined) {
            order.set_to_invoice(true);
        }
    },

    /**
     * Automatically print bill / customer receipt when the cashier clicks the Order button.
     */
    async sendOrderInPreparationUpdateLastChange(order, cancelled = false) {
        await super.sendOrderInPreparationUpdateLastChange(...arguments);
        const targetOrder = order || this.get_order();
            if (!cancelled && targetOrder && targetOrder.lines?.length > 0 && Boolean(this.config.print_bill_on_order)) {
                try {
                    await this.printReceipt({
                        order: targetOrder,
                        printBillActionTriggered: true,
                    });
                } catch (err) {
                    console.error("Failed to auto-print bill on order:", err);
                }
            }
        },

    /**
     * Override printReceipt to handle 2x printing for ePOS / hardware printers.
     * When enable_2x_printing is active (enabled by default), sends two sequential
     * print jobs to the ePOS printer, allowing ePOS to cut between them.
     */
    async printReceipt({
            basic = false,
            order = this.get_order(),
            printBillActionTriggered = false,
        } = {}) {
            await this._ensureOrderSequenceName(order);
            const is2xEnabled = Boolean(this.config.enable_2x_printing);
            if (!is2xEnabled) {
                return await super.printReceipt(...arguments);
            }

            const printCount = 2;
            let result = false;
            for (let i = 0; i < printCount; i++) {
                // Small delay between prints to allow ePOS printer to cut and reset buffer
                if (i > 0) {
                    await new Promise((resolve) => setTimeout(resolve, 350));
                }

                result = await this.printer.print(
                    OrderReceipt,
                    {
                        data: this.orderExportForPrinting(order),
                        formatCurrency: this.env.utils.formatCurrency,
                        basic_receipt: basic,
                    },
                    { webPrintFallback: i === 0 }
                );

                // If hardware / ePOS device is not connected, stop after 1st copy
                // to prevent browser popup blockers from choking on multiple window.print()
                if (!this.printer.device) {
                    break;
                }
            }

            if (!printBillActionTriggered) {
                order.nb_print += 2;
                if (typeof order.id === "number" && result) {
                    await this.data.write("pos.order", [order.id], { nb_print: order.nb_print });
                }
            }
            return true;
        },
    });

patch(TicketScreen.prototype, {
    /**
     * Use the pos.order sequence (e.g. "Restaurant/0001") when searching by Receipt Number
     * in the Ticket Screen search bar.
     */
    _getSearchFields() {
        const fields = super._getSearchFields(...arguments);
        if (fields.RECEIPT_NUMBER) {
            fields.RECEIPT_NUMBER.repr = (order) =>
                order.getOrderSequenceName ? order.getOrderSequenceName() : (order.name || order.pos_reference);
            fields.RECEIPT_NUMBER.modelField = "name";
        }
        return fields;
    },
});
