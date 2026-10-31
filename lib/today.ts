const ZONE = "Europe/Athens";

function athensDate(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function label(utcNoon: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(utcNoon);
}

export function todayLine(now: Date = new Date()): string {
  const { year, month, day } = athensDate(now);
  const days = Array.from({ length: 8 }, (_, i) => label(new Date(Date.UTC(year, month - 1, day + i, 12))));
  const list = days
    .map((d, i) => (i === 0 ? `Today = ${d}` : i === 1 ? `Tomorrow = ${d}` : d))
    .join("; ");
  return `CURRENT DATE: Today is ${days[0]} (${ZONE} time). Calendar for the next days: ${list}. Use ONLY this calendar to turn words such as "today", "tonight", "tomorrow" or a weekday name into the exact calendar date, and never say you do not know today's date.`;
}
