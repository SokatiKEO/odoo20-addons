import { deserializeDateTime } from "@web/core/l10n/dates";

const { DateTime } = luxon;

/**
 * Calculates elapsed duration in minutes from a given start datetime to now.
 * Handles Luxon DateTime instances, JavaScript Date objects, and ISO/SQL strings.
 *
 * @param {any} val - Start datetime representation.
 * @returns {number} Duration in full minutes (non-negative).
 */
export function safeDurationSince(val) {
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

    const timeDiff = (DateTime.now().ts - dt.ts) / 1000;
    return Math.max(0, Math.floor(timeDiff / 60));
}
