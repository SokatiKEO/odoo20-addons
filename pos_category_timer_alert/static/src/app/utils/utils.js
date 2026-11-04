import { deserializeDateTime } from "@web/core/l10n/dates";

const { DateTime } = luxon;

/**
 * Calculates elapsed duration in seconds from a given start datetime to now.
 *
 * @param {any} val - Start datetime representation.
 * @returns {number} Duration in full seconds (non-negative).
 */
export function safeDurationSecondsSince(val) {
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
    return Math.max(0, Math.floor(timeDiff));
}

/**
 * Calculates elapsed duration in minutes from a given start datetime to now.
 *
 * @param {any} val - Start datetime representation.
 * @returns {number} Duration in full minutes (non-negative).
 */
export function safeDurationSince(val) {
    return Math.floor(safeDurationSecondsSince(val) / 60);
}

/**
 * Returns segmented timer blocks for hours, minutes, and seconds:
 * - Only includes 'h' if >= 1 hour.
 * - Only includes 'm' if >= 1 minute or >= 1 hour.
 * - Always includes 's'.
 *
 * @param {number} totalSeconds - Total elapsed seconds.
 * @returns {Array<{val: string, unit: string}>} Array of timer block objects.
 */
export function getTimerParts(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;

    const pad = (num) => String(num).padStart(2, "0");

    const parts = [];
    if (hours > 0) {
        parts.push({ val: pad(hours), unit: "h" });
    }
    if (hours > 0 || minutes > 0) {
        parts.push({ val: pad(minutes), unit: "m" });
    }
    parts.push({ val: pad(seconds), unit: "s" });

    return parts;
}

/**
 * Formats elapsed seconds into a dynamic timer string:
 * - When >= 1 hour: 00h00m00s
 * - When >= 1 minute (< 1 hour): 00m00s
 * - When < 1 minute: 00s
 *
 * @param {number} totalSeconds - Total elapsed seconds.
 * @returns {string} Formatted duration string.
 */
export function formatTimer(totalSeconds) {
    return getTimerParts(totalSeconds)
        .map((p) => `${p.val}${p.unit}`)
        .join("");
}
