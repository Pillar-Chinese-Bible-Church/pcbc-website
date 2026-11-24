// Shared by the build and the request-time bulletin route. No Node-only dependencies.
import { timeZone } from "./locales.js";

const DAY = 86400000;
export const HISTORY_WEEKS = 52;
export const dateNumber = date => Date.parse(`${date}T00:00:00Z`);
export const dateString = number => new Date(number).toISOString().slice(0, 10);
export function sundayWindow(now = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now)).map(part => [part.type, part.value]));
  const today = dateNumber(`${parts.year}-${parts.month}-${parts.day}`);
  const weekday = new Date(today).getUTCDay();
  const sunday = today - weekday * DAY;
  return {
    sunday: dateString(sunday), nextSunday: dateString(sunday + 7 * DAY),
    // A church week is Monday through Sunday in America/Los_Angeles.
    bulletinSunday: dateString(weekday === 0 ? sunday : sunday + 7 * DAY),
    cutoff: dateString(sunday - (HISTORY_WEEKS - 1) * 7 * DAY)
  };
}
export function formatSermonDate(date, language) {
  return new Intl.DateTimeFormat(language, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(new Date(dateNumber(date)));
}
