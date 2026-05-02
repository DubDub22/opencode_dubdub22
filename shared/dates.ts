// All dates sent to external services (FastBound, ShipStation, Gmail, etc.)
// MUST use CST (America/Chicago) to avoid "date in the future" validation errors.
const TZ = "America/Chicago";

/** YYYY-MM-DD in CST — for FastBound disposition dates, ShipStation ship dates, etc. */
export function todayCST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** YYYYMMDD compact in CST — for order numbers, file name tags */
export function compactCST(): string {
  return todayCST().replace(/-/g, "");
}

/** ISO 8601 timestamp in CST */
export function nowCST(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: TZ }).replace(" ", "T");
}
