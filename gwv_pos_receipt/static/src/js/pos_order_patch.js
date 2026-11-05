/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { formatDateTime } from "@web/core/l10n/dates";
const { DateTime } = luxon;

patch(PosOrder.prototype, {
    /**
     * Return the pos.order sequence name (e.g. "Restaurant/0003").
     * Uses the backend sequence assigned to `this.name` once synced, or formats
     * a fallback `<ConfigName>/<0001>` before the order is synced to the server.
     */
    getOrderSequenceName() {
        const rawName = (this.name || "").trim();
        const isTempUniqId = /\d{5}-\d{3}-\d{4}/.test(rawName);
        if (rawName && rawName !== "/" && !isTempUniqId) {
            return rawName;
        }
        const configName = this.config?.name || "POS";
        const seqNum = this.sequence_number || 1;
        return `${configName}/${String(seqNum).padStart(4, "0")}`;
    },

    export_for_printing(baseUrl, headerData) {
        const result = super.export_for_printing(...arguments);
        const config = this.config;
        const company = this.company || headerData?.company || {};

        // Currency symbol (default $)
        const symbol = this.currency?.symbol || "$";

        // Exchange rate (default 4150 if unset or <= 1)
        let khrRate = config?.khr_exchange_rate;
        if (!khrRate || khrRate <= 1.0) {
            khrRate = 4150.0;
        }

        // Totals
        const amountTotal = this.get_total_with_tax() || 0.0;
        const totalInKHR = Math.round(amountTotal * khrRate);
        const discount = this.get_total_discount() || 0.0;
        const subtotal = (amountTotal + discount) || 0.0;

        // VAT / Tax Breakdown - Ensure it always says "VAT" instead of "Tax"
        const taxTotals = this.taxTotals;
        const taxList = [];
        if (taxTotals && taxTotals.has_tax_groups && taxTotals.subtotals) {
            for (const sub of taxTotals.subtotals) {
                for (const tg of sub.tax_groups || []) {
                    let name = (tg.group_name || "").trim();
                    // Replace "Tax" with "VAT"
                    name = name.replace(/tax/gi, "VAT").trim();
                    // Format percentage like (15%)
                    const pctMatch = name.match(/(\d+(?:\.\d+)?%)/);
                    if (pctMatch) {
                        name = `VAT (${pctMatch[1]})`;
                    } else if (!name.toUpperCase().includes("VAT")) {
                        name = `VAT ${name}`.trim();
                    }
                    taxList.push({
                        name: name || "VAT",
                        amount: (tg.tax_amount_currency || 0.0).toFixed(2),
                    });
                }
            }
        }

        // Change calculation
        const orderChange = this.get_change() || 0.0;
        const changeInKHR = Math.round(orderChange * khrRate);

        // Bill printed timestamp (current moment)
        let billPrintedDate = "";
        try {
            billPrintedDate = formatDateTime(DateTime.now());
        } catch (e) {
            const now = new Date();
            billPrintedDate = now.toLocaleString();
        }

        // Receipt logo
        let receiptLogoUrl = `/web/image?model=res.company&id=${company.id}&field=logo`;
        if (config?.has_receipt_custom_logo) {
            receiptLogoUrl = `/web/image?model=pos.config&id=${config.id}&field=receipt_custom_logo`;
        }

        // Header info with fallback to company defaults
        const headerCompanyName = config?.receipt_header_company_name || company.name || "";

        let vatTin = (config?.receipt_vat_tin || company.vat || "").trim();
        vatTin = vatTin.replace(/^(vat\s*tin|vat|tin)\s*:\s*/i, "").trim();

        let address = config?.receipt_address;
        if (!address) {
            address = company.english_address || [company.street, company.street2, company.city, company.zip].filter(Boolean).join(", ");
        }

        let phone = (config?.receipt_phone || company.phone || "").trim();
        phone = phone.replace(/^(tel|phone|telephone)\s*:\s*/i, "").trim();

        const footerNote = config?.receipt_footer_note || "Thank you for coming! Please come again!";
        const showSignature = config?.receipt_show_signature !== undefined ? config.receipt_show_signature : true;
        const invNo = this.getOrderSequenceName();

        // Customer name (defaults to 'Walk In' if not set)
        const customerName = this.partner_id ? this.partner_id.name : "Walk In";

        // Cashier name
        const cashierName = this.getCashierName() || "";

        // Formatted orderlines for receipt layout
        const customOrderlines = this.getSortedOrderlines().map((line) => {
            const displayData = line.getDisplayData();
            const qty = line.get_quantity();
            const unitPrice = line.get_unit_display_price();
            const price = line.get_display_price();

            return {
                ...displayData,
                formattedQty: Number.isInteger(qty) ? qty.toString() : qty.toFixed(2),
                formattedUnitPrice: unitPrice.toFixed(2),
                formattedPrice: price.toFixed(2),
            };
        });

        const fontSize = config?.receipt_font_size || 16;

        return {
            ...result,
            name: invNo,
            customReceipt: {
                logoUrl: receiptLogoUrl,
                companyName: headerCompanyName,
                vatTin: vatTin,
                address: address,
                phone: phone,
                fontSize: fontSize,
                date: result.date,
                invNo: invNo,
                cashierName: cashierName,
                customerName: customerName,
                billPrintedDate: billPrintedDate,
                orderlines: customOrderlines,
                subtotal: subtotal.toFixed(2),
                discount: discount.toFixed(2),
                taxList: taxList,
                grandTotalKHR: totalInKHR.toLocaleString("en-US"),
                grandTotalUSD: amountTotal.toFixed(2),
                totalSalesFormatted: `${symbol}${amountTotal.toFixed(2)}`,
                khrRate: khrRate.toLocaleString("en-US"),
                changeUSD: orderChange.toFixed(2),
                changeKHR: changeInKHR.toLocaleString("en-US"),
                showSignature: showSignature,
                footerNote: footerNote,
            },
        };
    },
});
