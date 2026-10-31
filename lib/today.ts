export function todayLine(now: Date = new Date()): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Athens",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  return `CURRENT DATE: Today is ${date} (Europe/Athens time). Use it to turn words such as "today", "tonight", "tomorrow" or a weekday name into the exact calendar date, and never say you do not know today's date.`;
}
