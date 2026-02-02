const formatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
  style: "narrow",
});
type RelativeTimeFormatUnit =
  | "year"
  | "years"
  | "quarter"
  | "quarters"
  | "month"
  | "months"
  | "week"
  | "weeks"
  | "day"
  | "days"
  | "hour"
  | "hours"
  | "minute"
  | "minutes"
  | "second"
  | "seconds";
const DIVISIONS: { amount: number; name: RelativeTimeFormatUnit }[] = [
  { amount: 60, name: "seconds" },
  { amount: 60, name: "minutes" },
  { amount: 24, name: "hours" },
  { amount: 7, name: "days" },
  { amount: 4.34524, name: "weeks" },
  { amount: 12, name: "months" },
  { amount: Number.POSITIVE_INFINITY, name: "years" },
];

export function formatTimeAgo(raw_date: number | string) {
  const date = typeof raw_date === "number" ? raw_date : new Date(raw_date).getTime();
  const currentDate = new Date();
  let duration = (date - currentDate.getTime()) / 1000;

  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (!division) return null;
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
}
