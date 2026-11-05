import { patch } from "@web/core/utils/patch";
import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { GeneratePrinterData } from "@point_of_sale/app/utils/printer/generate_printer_data";

const { DateTime } = luxon;

patch(PosOrder.prototype, {
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
});

patch(GeneratePrinterData.prototype, {
    _getCustomWaitingNumber(baseData) {
        const order = this.order;
        if (baseData?.extra_data?.table_name) {
            return String(baseData.extra_data.table_name);
        }
        if (order?.table_id) {
            const tableName =
                order.table_id.table_name ||
                order.table_id.getName?.() ||
                order.table_id.table_number;
            if (tableName !== undefined && tableName !== null && tableName !== "") {
                return String(tableName);
            }
        }
        if (order?.floating_order_name) {
            return String(order.floating_order_name);
        }
        if (order?.tracking_number) {
            return String(order.tracking_number);
        }
        return "";
    },

    _formatReceiptDateTime(order, baseData) {
        const rawDt = order?.date_order;
        if (rawDt) {
            const dt =
                typeof rawDt === "object" && rawDt.isLuxonDateTime
                    ? rawDt
                    : DateTime.fromSQL(String(rawDt), { zone: "utc" }).toLocal();
            if (dt && dt.isValid) {
                return dt.toFormat("dd-MM-yyyy hh:mm:ss a");
            }
        }
        const now = DateTime.now();
        if (now && now.isValid) {
            return now.toFormat("dd-MM-yyyy hh:mm:ss a");
        }
        return baseData?.extra_data?.formated_date_order || "";
    },

    generateCustomReceiptData(baseData) {
        const config = this.config;
        const company = this.company;
        const order = this.order;
        const symbol = this.currency?.symbol || "$";

        let khrRate = config?.khr_exchange_rate;
        if (!khrRate || khrRate <= 1.0) {
            khrRate = 4100.0;
        }

        const amountTotal = order.priceIncl || 0.0;
        const totalInKHR = Math.round((amountTotal * khrRate) / 100) * 100;
        const discount = Math.abs(order.getTotalDiscount?.() || 0.0);
        const subtotal = amountTotal + discount;

        let discountPctLabel = "";
        if (subtotal > 0 && discount > 0) {
            const pct = Math.round((discount / subtotal) * 10000) / 100;
            const pctStr = Number.isInteger(pct) ? String(pct) : pct.toFixed(2);
            discountPctLabel = `(${pctStr}%)`;
        }

        const rawChange = Math.abs(order.amount_return || order.change || 0.0);
        const changeInKHR = Math.round((rawChange * khrRate) / 100) * 100;

        const khmerCompanyName = config?.receipt_header_khmer_company_name || "";
        const headerCompanyName = config?.receipt_header_company_name || company?.name || "";

        let vatTin = (config?.receipt_vat_tin || company?.vat || "").trim();
        vatTin = vatTin.replace(/^(លេខអតប|vat\s*tin|vat|tin)\s*:\s*/i, "").trim();

        let address = config?.receipt_address;
        if (!address) {
            address =
                company?.english_address ||
                [company?.street, company?.street2, company?.city, company?.zip]
                    .filter(Boolean)
                    .join(", ");
        }

        let phone = (config?.receipt_phone || company?.phone || "").trim();
        phone = phone.replace(/^(tell|tel|phone|telephone)\s*:\s*/i, "").trim();

        const footerKhmerNote =
            config?.receipt_footer_khmer_note !== undefined &&
            config?.receipt_footer_khmer_note !== false
                ? config.receipt_footer_khmer_note
                : "សូមអញ្ជើញមកម្តងទៀត!";
        const footerNote =
            config?.receipt_footer_note !== undefined && config?.receipt_footer_note !== false
                ? config.receipt_footer_note
                : "Thank You so much for your support!";

        const invNo =
            order.getOrderSequenceName?.() ||
            order.name ||
            order.pos_reference ||
            "";
        const customerName = order.partner_id ? order.partner_id.name : "General";
        const cashierName =
            baseData?.extra_data?.cashier_name || order.getCashierName?.() || "";
        const fontSize = config?.receipt_font_size || 15;

        const orderlines = (order.getSortedOrderlines?.() || order.lines || []).map(
            (line, index) => {
                const qty = line.qty ?? 0;
                const price = line.displayPrice ?? 0;
                const noDiscUnit =
                    line.displayPriceUnitNoDiscount ??
                    (qty ? (line.displayPriceNoDiscount ?? price) / qty : line.displayPriceUnit ?? 0);
                const disc = line.discount ?? 0;
                const discStr = Number.isInteger(disc) ? `${disc}%` : `${disc.toFixed(1)}%`;
                const packLotLines = (line.pack_lot_ids || [])
                    .map((l) => l.lot_name)
                    .filter(Boolean);

                return {
                    index: index + 1,
                    product_name:
                        line.getFullProductName?.() ||
                        line.full_product_name ||
                        line.product_id?.display_name ||
                        "",
                    discount_str: discStr,
                    customer_note: line.customer_note || "",
                    pack_lot_lines: packLotLines,
                    formatted_qty: Number.isInteger(qty) ? String(qty) : qty.toFixed(2),
                    formatted_unit_price: `${symbol}${noDiscUnit.toFixed(2)}`,
                    formatted_price: `${symbol}${price.toFixed(2)}`,
                };
            }
        );

        let paymentLines = (order.payment_ids || []).map((pline) => {
            const amt = pline.amount_currency || pline.amount || 0.0;
            const paySymbol = pline.currency?.symbol || symbol;
            return {
                name: pline.payment_method_id?.name || "Cash",
                amount_formatted: `${paySymbol}${amt.toFixed(2)}`,
                ticket: pline.ticket || "",
            };
        });
        if (!paymentLines.length) {
            paymentLines = [
                {
                    name: "Cash",
                    amount_formatted: `${symbol}0.00`,
                    ticket: "",
                },
            ];
        }

        const formattedKhrRate = `${khrRate.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}៛`;

        return {
            khmer_company_name: khmerCompanyName,
            company_name: headerCompanyName,
            vat_tin: vatTin,
            address: address || "",
            phone: phone,
            font_size: fontSize,
            date: this._formatReceiptDateTime(order, baseData),
            inv_no: invNo,
            cashier_name: cashierName,
            customer_name: customerName,
            orderlines: orderlines,
            subtotal: `${symbol}${subtotal.toFixed(2)}`,
            discount: `${symbol}${discount.toFixed(2)}`,
            discount_pct_label: discountPctLabel,
            grand_total_khr: `${totalInKHR.toLocaleString("en-US")}៛`,
            grand_total_usd: `${symbol}${amountTotal.toFixed(2)}`,
            khr_rate: formattedKhrRate,
            show_change: Boolean(rawChange > 0 && !this.currency?.isZero?.(rawChange)),
            change_usd_formatted: `${symbol}${rawChange.toFixed(2)}`,
            change_khr: `${changeInKHR.toLocaleString("en-US")}៛`,
            payment_lines: paymentLines,
            waiting_number: this._getCustomWaitingNumber(baseData),
            footer_khmer_note: footerKhmerNote || "",
            footer_note: footerNote || "",
        };
    },

    generateReceiptData() {
        const data = super.generateReceiptData(...arguments);
        data.extra_data = data.extra_data || {};
        data.extra_data.custom_receipt = this.generateCustomReceiptData(data);
        return data;
    },
});
